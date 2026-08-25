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

   Six sets: deals, crm, operators, tasks, competitors, mentions.
   `deals` arrived on 2026-08-20 when the document mirror was retired
   and the pipeline stopped being a folder listing; `competitors` on
   2026-08-25 with the Competitor Tracker, and `mentions` the same day
   with the news blast — see README.txt. Adding a set is this one
   line, because nothing here understands a record.

   `mentions` is the first set NOT edited through the dashboard: the
   watchlist is its base and /api/blast appends what the sweep finds.
   That works without a change here for the reason the split exists —
   an overlay is a bag of deltas unioned by id, and it does not care
   whether a person or a cron pushed one.

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
   WHO CAN WRITE

   DASHBOARD_WRITE_KEY, sent as x-dashboard-key, is checked before
   anything is stored. It is a LOCK ON THE ENDPOINT, not
   authentication. The key is typed into each browser once and kept
   in localStorage, so it is not baked into the published page and
   does not appear in view-source. It is still one shared string,
   readable from the dev tools of any browser holding it, and it says
   nothing about WHO is writing.

   What it buys: a URL turning up in a log does not let a stranger
   rewrite the firm's investor records anonymously. That is worth ten
   lines and it is all it is worth.

   READS ARE NOT GATED AT ALL. Anyone with the URL gets the records,
   conversation notes included. Same posture as the rest of the
   dashboard — a decision, not an oversight — and the first thing to
   fix if this ever needs to be private.
   ============================================================ */

import {
  redisConfigured,
  readBase,
  writeBase,
  appendOverlay,
  readOverlay,
  clearOverlay,
  overlayLength,
  trimOverlay
} from "./_store.js";

/* A whitelist, not a sanitiser: `set` becomes part of a Redis key,
   so anything not on this list must not reach it. */
const SETS = new Set(["deals", "crm", "operators", "tasks", "competitors", "mentions"]);

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

function writable(req, res) {
  const key = process.env.DASHBOARD_WRITE_KEY;
  if (key && req.headers["x-dashboard-key"] !== key) {
    res.status(403).json({ error: "Not allowed to write." });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!allow(req, res)) return;

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dashboard-key");
    res.status(204).end();
    return;
  }

  const q = req.query || {};

  if (q.probe) {
    res.status(200).json({
      ok: true,
      configured: redisConfigured(),
      writeLocked: !!process.env.DASHBOARD_WRITE_KEY,
      sets: [...SETS]
    });
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
      const [base, overlay, count] = await Promise.all([
        readBase(set), readOverlay(set), overlayLength(set)
      ]);
      res.setHeader("Cache-Control", "no-store");
      // `count` is how many deltas produced that overlay. The page hands it
      // back when it publishes, so the trim can be exact — see trimOverlay().
      res.status(200).json({ ok: true, set, base, overlay, count });
      return;
    }

    if (req.method === "POST") {
      if (!writable(req, res)) return;

      const payload = body(req);
      if (payload === null) { res.status(400).json({ error: "Body is not JSON." }); return; }
      const by = String(payload.by || "").slice(0, 80) || null;

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
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({ ok: true, set, published: true, base: stamped, overlay: {} });
        return;
      }

      /* An ordinary edit. One atomic append — see appendOverlay() in
         _store.js for why nothing is read first and why simultaneous
         writers therefore cannot clobber each other. */
      const delta = payload.overlay || payload;
      await appendOverlay(set, delta);

      // Return the folded overlay so the writer immediately sees
      // whatever other people have saved since their last load.
      const overlay = await readOverlay(set);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true, set, overlay });
      return;
    }

    res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    res.status(502).json({ error: e.message || "Records store failed." });
  }
}
