/* ============================================================
   /api/records — the deal pipeline, the two CRMs, the task list

   REPLACES /api/overlay, and the difference is the point. That
   endpoint served only the shared EDITS; the base records still
   arrived as crm-data.json committed into the repository. Making an
   edit permanent therefore meant: download the merged file, drop it
   in the site folder, commit, push, redeploy. Every person, every
   time. That loop is what this removes.

   Now both halves live in Redis and the loop is one button.

     GET  /api/records?set=deals          { base, overlay }
     POST /api/records?set=deals          append an edit
     POST /api/records?set=deals&op=publish  make edits the new base
     GET  /api/records?probe=1            configured or not

   Six sets: deals, crm, lps, operators, tasks, competitors.
   `deals` arrived on 2026-08-20 when the document mirror was retired
   and the pipeline stopped being a folder listing; `competitors` on
   2026-08-25 with the Competitor Tracker. `mentions` arrived the same
   day with the news blast and went with it on 2026-09-15 — see
   README.txt. Adding or removing a set is this one line, because
   nothing here understands a record.

   `lps` arrived on 2026-09-15 with the LP CRM. It is deliberately NOT
   part of `crm`: the two hold different populations. `crm` is LPs FOR
   MODILLION — the people the firm raises money from, and every
   commitment on a Capital Raise is one of them. `lps` is LPs FOR OUR
   PARTNERS AND DEALS — the capital partner sitting beside us on a deal.
   A firm can be both, and when it is, that is two relationships with one
   firm rather than one record filed twice.

   ------------------------------------------------------------
   WHY BASE AND OVERLAY ARE STILL SEPARATE

   It would look tidier to fold every edit straight into the base and
   serve one document. It would also mean re-implementing, on the
   server, the several hundred lines in dashboard.html that know how
   a patch applies to an investor, how a conversation is appended,
   how a tombstone hides a deal. That logic is per-module, fiddly,
   and correct today.

   So the split stays and the server stays ignorant. It stores two
   documents and unions the deltas; the page merges base + overlay
   exactly as it always has. Nothing that understands a record had to
   move, which is why this change is small enough to trust.

   PUBLISH is the seam where they meet, and it is deliberately the
   DUMBEST possible operation: the page already computes the fully
   merged document — that is what "Download crm-data.json" hands you,
   from toFile() — so publish just stores that as the new base and
   drops the deltas it accounted for. The server still never has to
   understand a record.

   ------------------------------------------------------------
   WHO CAN READ, AND WHO CAN WRITE — CHANGED 2026-09-15

   BOTH, NOW, REQUIRE A SIGNED-IN PERSON. Every method below goes
   through requireUser() in _auth.js, which verifies a Supabase
   magic-link token and checks the address is on the firm's domain.
   No token, no records.

   That is a change in kind, not degree, and it is worth being
   precise about what it replaced:

     WAS: reads were not gated at all. Anyone with the URL got the
          records, conversation notes included. Writes were gated by
          DASHBOARD_WRITE_KEY — one shared string in every
          colleague's localStorage, readable from the dev tools of
          any browser holding it, saying nothing about WHO wrote.

     NOW: both are gated by a per-person token that this server
          verifies by signature. DASHBOARD_WRITE_KEY IS GONE from
          this endpoint — it was a weaker check sitting behind a
          stronger one, and leaving it in place would have meant
          every browser still needing a string typed into it for no
          remaining benefit.

   `publishedBy` IS NOW SERVER-STAMPED from the verified token
   rather than read from the request body. It used to be whatever
   the browser said it was, which made it a label rather than a
   fact.

   THE HONEST LIMIT: the deltas inside an overlay still carry
   whatever authorship the PAGE wrote into them — the `by` on a
   logged conversation, say. Those are record content, not envelope,
   and this file does not understand record content by design. A
   signed-in colleague can still write a note attributed to a
   different colleague. Everyone who gets past requireUser() has the
   same access to all seven sets; there is no per-record permission
   here and nowhere to put one while the store holds documents
   rather than rows. See README.txt.
   ============================================================ */

import { requireUser, authConfigured } from "./_auth.js";
import {
  redisConfigured,
  readBase,
  writeBase,
  appendOverlay,
  readStamps,
  readOverlay,
  clearOverlay,
  overlayLength,
  trimOverlay
} from "./_store.js";

/* A whitelist, not a sanitiser: `set` becomes part of a Redis key,
   so anything not on this list must not reach it. */
const SETS = new Set(["deals", "crm", "lps", "operators", "tasks", "competitors"]);

function allow(req, res) {
  const allowed = process.env.DASHBOARD_ALLOWED_ORIGIN;
  if (!allowed) return true;
  const origin = req.headers.origin || "";
  if (origin && origin !== allowed) {
    res.status(403).json({ error: "Origin not allowed." });
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", allowed);
  return true;
}

function body(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (!allow(req, res)) return;

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).end();
    return;
  }

  const q = req.query || {};

  /* THE ONE THING LEFT OPEN, and deliberately: two booleans saying
     whether this deployment has a store and an authenticator wired up.
     It names no set, reports no count and touches no record, so it
     answers "is the deployment configured" without answering anything
     about the firm. That is worth keeping reachable — it is what you
     curl at three in the afternoon when the dashboard says it cannot
     reach anything and you need to know which half is missing. */
  if (q.probe) {
    res.status(200).json({
      ok: true,
      configured: redisConfigured(),
      authConfigured: authConfigured()
    });
    return;
  }

  /* EVERYTHING BELOW THIS LINE REQUIRES A SIGNED-IN PERSON. It is
     placed here, above the `set` check and above the stamps poll,
     precisely so that no branch added later can accidentally sit in
     front of it. */
  const user = await requireUser(req, res);
  if (!user) return;

  /* THE LIVE POLL. Every set's change stamp in one small answer, so a
     page can find out whether anything moved without reading a single
     record. This is deliberately ahead of the `set` check below: the
     question is about all of them at once. */
  if (q.op === "stamps") {
    const stamps = await readStamps([...SETS]);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, stamps });
    return;
  }

  const set = String(q.set || "");
  if (!SETS.has(set)) {
    res.status(400).json({ error: "Unknown set.", sets: [...SETS] });
    return;
  }

  /* No store configured is a NORMAL state, not a broken one: the
     dashboard falls back to its local JSON files and its own
     localStorage overlay, behaving exactly as it did before any of
     this existed. That is why the page falls through quietly. */
  if (!redisConfigured()) {
    res.status(503).json({
      ok: false,
      error: "No records store configured.",
      missing: ["KV_REST_API_URL", "KV_REST_API_TOKEN"]
        .filter(k => !process.env[k] && !process.env[k.replace("KV_REST_API", "UPSTASH_REDIS_REST")])
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const [base, overlay, count, stamps] = await Promise.all([
        readBase(set), readOverlay(set), overlayLength(set), readStamps([set])
      ]);
      res.setHeader("Cache-Control", "no-store");
      // `count` is how many deltas produced that overlay. The page hands it
      // back when it publishes, so the trim can be exact — see trimOverlay().
      // `stamp` is where this payload sits in the set's history, so the live
      // poll has something to compare against without guessing.
      res.status(200).json({ ok: true, set, base, overlay, count, stamp: stamps[set] || 0 });
      return;
    }

    if (req.method === "POST") {
      const payload = body(req);
      if (payload === null) { res.status(400).json({ error: "Body is not JSON." }); return; }
      /* FROM THE TOKEN, NOT FROM THE BODY. payload.by is ignored — it was
         self-declared, which is what made "who published this" a question
         nobody could actually answer. */
      const by = user.email;

      /* PUBLISH — the old download-commit-push loop, as one call.
         The page sends its fully merged document; it becomes the new
         base and the deltas that produced it are dropped.

         The order matters and it is the cautious way round: store the
         base FIRST, clear the overlay second. A failure between the
         two leaves edits applied twice — which the union merge makes
         a no-op, since re-merging a patch that is already in the base
         changes nothing. The other order would lose them. */
      if (q.op === "publish") {
        const doc = payload.doc;
        if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
          res.status(400).json({ error: "publish needs a doc object." });
          return;
        }
        const stamped = Object.assign({}, doc, {
          publishedAt: new Date().toISOString(),
          publishedBy: by
        });
        await writeBase(set, stamped);
        /* `seen` is how many deltas the page had folded into the document
           above. Trim exactly those and anything that arrived while it was
           being computed stays queued, to be folded by the next publish.
           Without it the only option is dropping the whole list, which
           discards those newer deltas — tolerable when a person pressed a
           button, not when this runs on a timer. Absent, the old behaviour
           stands, so an older page still publishes correctly. */
        const seen = Number(payload.seen);
        if (Number.isFinite(seen) && seen > 0) await trimOverlay(set, seen);
        else await clearOverlay(set);
        const after = await readStamps([set]);
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({ ok: true, set, published: true, base: stamped,
                               overlay: {}, stamp: after[set] || 0 });
        return;
      }

      /* An ordinary edit. One atomic append — see appendOverlay() in
         _store.js for why nothing is read first and why simultaneous
         writers therefore cannot clobber each other. */
      const delta = payload.overlay || payload;
      await appendOverlay(set, delta);

      // Return the folded overlay so the writer immediately sees
      // whatever other people have saved since their last load.
      const [overlay, stamps] = await Promise.all([
        readOverlay(set), readStamps([set])
      ]);
      res.setHeader("Cache-Control", "no-store");
      // The stamp this write produced. Handed back so the writer's own
      // edit does not read as somebody else's change on the next poll.
      res.status(200).json({ ok: true, set, overlay, stamp: stamps[set] || 0 });
      return;
    }

    res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    res.status(502).json({ error: e.message || "Records store failed." });
  }
}
