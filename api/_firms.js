/* ============================================================
   api/_firms.js — which firms exist, and who may reach them

   Underscore-prefixed for the same reason as _store.js and
   _auth.js: Vercel turns every file in /api into a route, except
   ones beginning with "_". This is a registry, not an endpoint,
   and it must never become one — see "WHAT MUST NOT LEAVE HERE".

   ------------------------------------------------------------
   WHY THIS FILE EXISTS

   The dashboard used to serve one firm. It now serves one firm PER
   URL — dashboard.html?firm=fairwind — and the firm id is not a
   convenience selector. It is a PERMISSION BOUNDARY: Fairwind's
   people sign in with their own addresses and must reach Fairwind's
   records and nothing else.

   That makes this file the answer to two questions that used to have
   one global answer each:

     which records exist      was: six Redis keys
                              now: six per firm

     who is allowed in        was: one email domain, _auth.js
                              now: a domain (or an explicit grant)
                                   PER FIRM, resolved here

   ------------------------------------------------------------
   WHAT MUST NOT LEAVE HERE

   `strategy` and `team` are SERVER-ONLY. They are spliced into the
   system prompts in agent.js and research.js, and a system prompt is
   the one place a request body must never reach — see the note at
   agent.js:169. If either of these ever arrives from the caller
   instead of from this file, a Fairwind user can rewrite the
   assistant's brief and a Modillion one can read it.

   There is a SECOND, SMALLER copy of this registry inlined in
   dashboard.html (the `Firm` module). That copy holds display name,
   short name, logo and tab list — the things a public static file may
   carry — and it holds NO domains, NO grants, NO strategy. The
   duplication is deliberate and it is the same arrangement the page
   already uses for GATE_USERS, which is documented there as not being
   a permission check. Do not "tidy" the two into one: the tidy version
   either publishes the access rules or blocks the page on a fetch
   before it can paint a sign-in form.
   ============================================================ */

/* The firm a bare dashboard.html means. Every bookmark predating the
   multi-tenant change has no ?firm, and all of them are Modillion's. */
export const DEFAULT_FIRM = "modillion";

/* DASHBOARD_ALLOWED_DOMAIN is honoured for Modillion alone, because
   that is what it has always meant and something in the deployment may
   still be setting it. It is NOT a global control any more: read as
   one, it would admit Fairwind addresses to Modillion. */
const MODILLION_DOMAIN = (process.env.DASHBOARD_ALLOWED_DOMAIN || "modillionpartners.com").toLowerCase();

const FIRMS = {
  modillion: {
    id: "modillion",
    name: "Modillion Partners",
    /* Used for the "MP GP check" column — the reader's own share of the
       GP cheque. The field key in the records stays `mpGpCheck`
       whichever firm is reading; only the LABEL follows the firm. */
    short: "MP",
    domains: [MODILLION_DOMAIN],
    logo: "images/modillion-logo-white.png",
    hero: "page-hero--nyc-lobby",
    site: "modillionpartners.com",
    contact: "info@modillionpartners.com",
    /* One sentence, and it does real work: it is what the research
       prompts mean by "a competitor" and what the assistant understands
       "we" to be. Getting it wrong produces plausible, confidently
       wrong research rather than an error. */
    strategy: "a real-estate investment firm that writes Co-GP equity and seeds sponsors",
    team: [
      { id: "dw", name: "David Wolfson", email: "dwolfson@modillionpartners.com", role: "Managing Partner" },
      { id: "ce", name: "Corey Ernst",   email: "cernst@modillionpartners.com",   role: "Partner" },
      { id: "ee", name: "Eric Emrich",   email: "eemrich@modillionpartners.com",  role: "Partner, CFO" },
      { id: "jb", name: "John Brosens",  email: "jbrosens@modillionpartners.com", role: "Partner" }
    ]
  },

  fairwind: {
    id: "fairwind",
    name: "Fairwind",
    short: "FW",
    domains: ["fairwind-partners.com"],
    logo: "images/fairwind-logo.png",
    hero: "page-hero--philly-sunset",
    site: "fairwind-partners.com",
    contact: "",
    /* Reads into the prompts as "the internal dashboard of Fairwind,
       <this>." It is what "we" means to the assistant and what the
       Competitor Tracker treats as a peer, so it does real work —
       wrong, it does not error, it returns confident research about
       the wrong industry. Taken from the partnership card on
       partnerships.html; sharpen it when Fairwind say how they
       describe themselves. */
    strategy: "an affordable housing real-estate developer and operator",
    /* Empty on purpose. The roster is what the Task List offers as
       assignees and what Tasks.team() feeds the assistant; seeded with
       Modillion's four names it would put this firm's colleagues'
       names and addresses in front of another firm's staff, and in
       front of the model, without erroring. Fill it when Fairwind's
       people have accounts. */
    team: []
  }
};

/* Cross-firm access, for the case the domains cannot express: a
   Modillion partner who also works inside a partner firm's dashboard.

     DASHBOARD_FIRM_GRANTS="john@modillionpartners.com:modillion|fairwind"

   Comma- or space-separated entries, each `email:firm|firm`. Grants
   ADD to whatever the domains already allow; there is no syntax for
   taking access away, because a grant that silently removed one would
   be a permission check hiding in a convenience feature. To remove
   someone, remove their account. */
function parseGrants(raw) {
  const out = {};
  String(raw || "")
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(entry => {
      const at = entry.lastIndexOf(":");
      if (at < 1) return;
      const email = entry.slice(0, at).trim().toLowerCase();
      const firms = entry.slice(at + 1).split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!email || !firms.length) return;
      out[email] = (out[email] || []).concat(firms.filter(f => f in FIRMS));
    });
  return out;
}

const GRANTS = parseGrants(process.env.DASHBOARD_FIRM_GRANTS);

/* Is this a firm this deployment knows about? The only safe way to ask,
   and the thing every key, prompt and guard is gated on. */
export function isFirm(id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(FIRMS, id);
}

export function firmIds() {
  return Object.keys(FIRMS);
}

/* The whole record for a firm, strategy and team included. Server-side
   callers only — see "WHAT MUST NOT LEAVE HERE" above. Throws rather
   than returning null, because every caller is about to build a Redis
   key or a system prompt out of it and there is no sensible way to
   carry on with neither. */
export function firm(id) {
  if (!isFirm(id)) throw new Error("Unknown firm: " + String(id));
  return FIRMS[id];
}

/* EVERY firm this address may reach, from domain match plus explicit
   grants. Returns a possibly-empty array, and an empty one means NO
   ACCESS — never "the default firm". That inversion is exactly how a
   global gate quietly disappears, so callers must treat [] as a
   refusal; authoriseFirm() below is the only intended caller. */
export function grantedFirms(email) {
  const addr = String(email || "").trim().toLowerCase();
  if (!addr) return [];
  const at = addr.lastIndexOf("@");
  if (at < 0) return [];
  const domain = addr.slice(at + 1);

  const out = [];
  firmIds().forEach(id => {
    if (FIRMS[id].domains.some(d => d && d === domain)) out.push(id);
  });
  (GRANTS[addr] || []).forEach(id => { if (!out.includes(id)) out.push(id); });
  return out;
}

/* ============================================================
   THE AUTHORISATION, AND WHY IT RETURNS ONE ID RATHER THAN A LIST

   Callers get back a single authorised firm id, checked against the
   one they asked for. The obvious alternative — hand the handler the
   array from grantedFirms() and let it choose — reads fine and fails
   open, because the shape invites this:

     user.firms.includes(q.firm) ? q.firm : user.firms[0]

   A dual-access person types ?firm=fiarwind and lands silently in
   Modillion. No error, no refusal, wrong tenant, and the fallback also
   makes correctness depend on the order of the keys in this file.

   One id has nothing to fall back to. That is the entire argument.

   The two failures are deliberately DIFFERENT KINDS of failure:

     unknown id    a typo or a stale link. Nothing to do with who is
                   asking, so it is not a permission failure — the
                   caller reports 400.
     known, not
     granted       a real refusal — the caller reports 403, and
                   crucially with signIn:false, because that person's
                   token is fine and sending them back to sign in
                   would just loop them.
   ============================================================ */
export const FIRM_UNKNOWN = "unknown-firm";
export const FIRM_DENIED = "firm-denied";

export function authoriseFirm(email, requested) {
  const id = String(requested || "").trim().toLowerCase() || DEFAULT_FIRM;
  if (!isFirm(id)) return { ok: false, reason: FIRM_UNKNOWN, firm: null };
  const granted = grantedFirms(email);
  if (!granted.includes(id)) return { ok: false, reason: FIRM_DENIED, firm: null };
  return { ok: true, reason: null, firm: id };
}
