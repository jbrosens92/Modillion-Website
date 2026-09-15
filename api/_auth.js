/* ============================================================
   api/_auth.js — who is asking

   Underscore-prefixed for the same reason as _store.js: Vercel
   turns every file in /api into a route, except ones beginning
   with "_". This is a helper, not an endpoint.

   WHAT THIS REPLACES, AND WHY IT IS DIFFERENT IN KIND

   Until now the dashboard had two things that looked like access
   control and were not:

     a) GATE_USERS in dashboard.html — a username and password
        checked IN THE BROWSER, on a page served publicly. Anyone
        who opened dev tools could set the session flag and skip
        the form. It never protected a single record, because the
        records do not come from the page; they come from
        /api/records, which never asked whether the form had been
        passed.

     b) DASHBOARD_WRITE_KEY — one shared string, in every
        colleague's localStorage, readable from the dev tools of
        any browser holding it, saying nothing about WHO was
        writing. A lock on the endpoint, as its comment always
        admitted, and only ever that.

   Both ran on the wrong side of the wire or carried no identity.
   This runs on the server, on every request, and it carries a
   person. That is the whole difference, and it is the reason
   /api/records can finally refuse a stranger.

   HOW IT WORKS

   Supabase Auth signs the team in — an address on the firm's
   domain and that person's own password, checked by Supabase
   rather than by us. What comes back to the browser is a JWT. The
   browser sends it as `Authorization: Bearer <token>`, and this
   file checks the SIGNATURE before it believes a word of the
   contents.

   NOTHING HERE KNOWS HOW THE TOKEN WAS OBTAINED, and that is worth
   keeping true. This was built for magic links and switched to
   passwords when it turned out the firm had no mail provider (see
   README.txt); not one line of this file changed. Whatever the
   sign-in method becomes next — links again, SSO, passkeys — it
   stays that way as long as Supabase issues the token.

   That order matters. A JWT is just base64 — its `email` claim is
   a string anybody can type. It is worth exactly as much as the
   signature check that precedes reading it, and nothing at all
   without one.

   NO PACKAGE, DELIBERATELY. Same reasoning as _store.js talking to
   Upstash over plain fetch: verification is a signature check and
   three claim comparisons, all of which node:crypto does natively.
   A JWT library here would be a dependency to keep in step with a
   lockfile, and a supply-chain surface on the one file that decides
   who gets the firm's investor records. It is not worth it.

   BOTH SIGNING SCHEMES ARE ACCEPTED, for the same reason redisEnv()
   accepts two sets of variable names: which one you get depends on
   when and how the Supabase project was made, and that is not worth
   a support conversation later.

     HS256   the project's shared JWT secret, in SUPABASE_JWT_SECRET.
             Older projects, and still offered by new ones.
     ES256   an asymmetric signing key, with the public half served
     RS256   at /auth/v1/.well-known/jwks.json. Newer default.
             Nothing secret is configured for these — the public key
             is fetched and cached.

   WHAT THIS DOES NOT DO

   It answers "is this a signed-in member of the firm", and that is
   all it answers. Everyone who passes gets the same access to
   everything. There is no per-record permission here and there is no
   place to put one, because the store holds seven JSON documents
   rather than rows anybody can write a policy against. If one
   partner should not see another's LPs, that is a different and much
   larger change — see README.txt.
   ============================================================ */

import { createHmac, createPublicKey, verify as verifySignature, timingSafeEqual } from "node:crypto";

/* The addresses allowed through. The domain is the normal control;
   DASHBOARD_ALLOWED_EMAILS narrows it to named people if that is ever
   wanted. Both are checked AFTER the signature, never instead of it. */
const ALLOWED_DOMAIN = (process.env.DASHBOARD_ALLOWED_DOMAIN || "modillionpartners.com").toLowerCase();
const ALLOWED_LIST = String(process.env.DASHBOARD_ALLOWED_EMAILS || "")
  .split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

/* Clock skew. Vercel's clock and Supabase's clock are both right; they
   are not right to the millisecond, and a token rejected because it
   expired half a second ago reads to the user as a random sign-out. */
const SKEW_SECONDS = 30;

export function authConfigured() {
  return !!process.env.SUPABASE_URL;
}

function issuer() {
  return String(process.env.SUPABASE_URL || "").replace(/\/+$/, "") + "/auth/v1";
}

/* An error that knows what the browser should DO about it, which is
   the only distinction the client actually needs:

     401  the token is missing, malformed, expired or unsigned —
          signing in again fixes it.
     403  the token is perfectly valid and the person is not allowed
          here — signing in again changes nothing.

   Collapsing those two into one status is what produces the sign-in
   loop where a stranger's browser bounces through the magic-link
   flow forever without ever being told why. */
class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ============================================================
   THE SIGNATURE
   ============================================================ */

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(String(seg), "base64url").toString("utf8"));
}

/* JWKS, cached in module scope. A warm function reuses it; a cold one
   pays a single fetch. Re-fetched when a token arrives carrying a `kid`
   this copy has never seen, which is what makes key rotation a
   non-event rather than an outage. */
let jwksCache = { keys: [], fetchedAt: 0 };
const JWKS_MIN_REFETCH_MS = 60 * 1000;

async function jwks(kid) {
  const known = jwksCache.keys.find(k => k.kid === kid);
  if (known) return known;
  // Unknown kid. Refetch, but not more than once a minute — an
  // unrecognised key must not turn into one outbound request per
  // inbound request.
  if (Date.now() - jwksCache.fetchedAt < JWKS_MIN_REFETCH_MS) return null;

  const r = await fetch(issuer() + "/.well-known/jwks.json", {
    headers: { apikey: process.env.SUPABASE_ANON_KEY || "" }
  });
  if (!r.ok) throw new AuthError(401, "Could not fetch the signing keys.");
  const j = await r.json();
  jwksCache = { keys: Array.isArray(j && j.keys) ? j.keys : [], fetchedAt: Date.now() };
  return jwksCache.keys.find(k => k.kid === kid) || null;
}

function verifyHs256(signingInput, signature) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new AuthError(401, "This token is HS256-signed but no SUPABASE_JWT_SECRET is set.");
  }
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  // Lengths must match before timingSafeEqual will look at them, and a
  // forged token is free to be the wrong length.
  return expected.length === signature.length && timingSafeEqual(expected, signature);
}

async function verifyAsymmetric(alg, kid, signingInput, signature) {
  const jwk = await jwks(kid);
  if (!jwk) throw new AuthError(401, "Token signed by an unknown key.");
  const key = createPublicKey({ key: jwk, format: "jwk" });

  if (alg === "ES256") {
    /* A JWS ECDSA signature is the raw r||s pair. Node defaults to
       expecting DER, and silently returns false for the other one —
       so this flag is the difference between working and a
       mysteriously invalid signature on every request. */
    return verifySignature("sha256", signingInput, { key, dsaEncoding: "ieee-p1363" }, signature);
  }
  if (alg === "RS256") {
    return verifySignature("sha256", signingInput, key, signature);
  }
  throw new AuthError(401, "Unsupported token algorithm: " + alg);
}

/* ============================================================
   THE CLAIMS

   Checked only once the signature has been proved, and every one of
   them matters:

     exp   an expired token is not a token. Without this check a
           single leaked token is a permanent key.
     iss   pins the token to THIS Supabase project. Without it, a
           token minted by any other Supabase project on the
           internet — anybody's, including one the attacker made a
           minute ago — verifies against that project's own JWKS
           and sails through.
     role  KEEP THIS EVEN THOUGH IT LOOKS REDUNDANT. This project
           uses an "sb_publishable_..." key, which is not a JWT and
           could never pass the signature check above. The key it
           replaced — the old "anon" key — WAS a JWT, signed by the
           project itself and carrying role "anon", and it ships in
           the page. On a project of that vintage, without this line,
           the public key is a skeleton key to the firm's records.
           Rotating back to legacy keys would restore that, silently.
     email the person, and the only claim the rest of the app reads.
   ============================================================ */

function checkClaims(claims) {
  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.exp !== "number" || claims.exp + SKEW_SECONDS < now) {
    throw new AuthError(401, "Session expired.");
  }
  if (typeof claims.nbf === "number" && claims.nbf - SKEW_SECONDS > now) {
    throw new AuthError(401, "Token is not valid yet.");
  }
  if (claims.iss !== issuer()) {
    throw new AuthError(401, "Token was not issued by this project.");
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes("authenticated")) {
    throw new AuthError(401, "Token is not an authenticated session.");
  }
  if (claims.role !== "authenticated") {
    throw new AuthError(401, "Token is not an authenticated session.");
  }

  const email = String(claims.email || "").trim().toLowerCase();
  if (!email) throw new AuthError(403, "This account has no email address.");

  const domainOk = email.endsWith("@" + ALLOWED_DOMAIN);
  const listOk = ALLOWED_LIST.length ? ALLOWED_LIST.includes(email) : true;
  if (!domainOk || !listOk) {
    throw new AuthError(403, "This account is not allowed to use the dashboard.");
  }

  return { id: String(claims.sub || ""), email };
}

/* Verify a bearer token and return { id, email }. Throws AuthError. */
export async function verifyToken(token) {
  if (!authConfigured()) throw new AuthError(401, "No authentication is configured.");

  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new AuthError(401, "Malformed token.");

  let header;
  try { header = decodeSegment(parts[0]); }
  catch (e) { throw new AuthError(401, "Malformed token header."); }

  /* THE ALGORITHM IS DECIDED FIRST, before anything else in the token is
     decoded. "none" is the oldest JWT hole there is — a token carrying no
     signature, which a naive verifier accepts because it asked the TOKEN
     which algorithm to use. The whitelist below is what closes it, and
     putting it ahead of the decode means a token naming an algorithm we
     will never accept is refused without its contents being parsed at
     all. */
  const alg = String(header.alg || "");
  if (alg !== "HS256" && alg !== "ES256" && alg !== "RS256") {
    throw new AuthError(401, "Unsupported token algorithm.");
  }

  const signingInput = Buffer.from(parts[0] + "." + parts[1], "utf8");
  const signature = Buffer.from(parts[2], "base64url");

  let ok = false;
  if (alg === "HS256") ok = verifyHs256(signingInput, signature);
  else ok = await verifyAsymmetric(alg, header.kid, signingInput, signature);

  if (!ok) throw new AuthError(401, "Token signature is not valid.");

  let claims;
  try { claims = decodeSegment(parts[1]); }
  catch (e) { throw new AuthError(401, "Malformed token body."); }

  return checkClaims(claims);
}

/* ============================================================
   THE GUARD

   Call at the top of a handler:

     const user = await requireUser(req, res);
     if (!user) return;            // it has already answered

   Returns the person, or null having already sent the response —
   the same shape as the existing allow() and writable() helpers in
   records.js, so it reads the way the file already reads.
   ============================================================ */

export async function requireUser(req, res) {
  /* An unconfigured deployment must FAIL CLOSED. This is the one place
     in the codebase where "not configured" cannot mean "carry on
     without it" — that is exactly the posture being fixed, and a
     missing variable would silently restore it. Compare _store.js,
     where an absent store legitimately degrades to local files. */
  if (!authConfigured()) {
    res.status(503).json({
      error: "Authentication is not configured on this deployment.",
      missing: ["SUPABASE_URL"]
    });
    return null;
  }

  const header = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(header));
  if (!m) {
    res.setHeader("WWW-Authenticate", "Bearer");
    res.status(401).json({ error: "Sign in to use the dashboard.", signIn: true });
    return null;
  }

  try {
    return await verifyToken(m[1].trim());
  } catch (e) {
    /* An AuthError is a considered refusal and its message is meant to be
       read. ANYTHING ELSE is a bug in here or an outage at Supabase, and
       its message is not for the browser: it fails closed as a 401, but
       the detail goes to the log rather than to whoever is asking. */
    const known = e instanceof AuthError;
    if (!known) console.error("auth: unexpected failure verifying a token:", e);
    const status = known ? e.status : 401;
    if (status === 401) res.setHeader("WWW-Authenticate", "Bearer");
    /* `signIn` tells the page to send the reader back to the sign-in
       screen. It is deliberately false on a 403: that person's token is
       fine and signing in again would just loop them. */
    res.status(status).json({
      error: known ? (e.message || "Not signed in.") : "Could not verify the session.",
      signIn: status === 401
    });
    return null;
  }
}
