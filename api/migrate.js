/* ============================================================
   api/migrate.js — ONE-OFF. DELETE THIS FILE AFTER IT HAS RUN.

   Moves the six base documents from the single-firm key names to the
   per-firm ones the multi-tenant code reads:

     modillion:base:crm    ->    modillion:modillion:base:crm

   WHY A ROUTE RATHER THAN THE UPSTASH CONSOLE

   The alternative is pasting six large JSON documents through a web
   console by hand. That is not safer for being manual — it is six
   chances to paste into the wrong key, truncate a document, or lose a
   character, with no check on the result.

   It also keeps a property the rest of this codebase is careful about:
   nobody's laptop ever holds the Redis credentials (see the note in
   tools/publish.py). This runs on the server, where they already are.

   WHY IT TALKS TO REDIS DIRECTLY INSTEAD OF USING _store.js

   Because _store.js cannot address these keys, ON PURPOSE. Its KEY()
   throws without a registered firm, and the OLD keys have no firm
   segment at all. Adding an escape hatch there to let this file in
   would put a permanent hole in the one guarantee that module makes.
   A temporary file that gets deleted can carry fifteen lines of its
   own plumbing instead.

   WHAT IT WILL NOT DO

     - It never writes a destination that already holds data. Running
       it twice is a no-op that says so.
     - It never touches the old keys. They stay exactly where they are,
       which is the only rollback that exists. Leave them a week.
     - It never copies an overlay LIST. Those must be drained by
       publishing first, because copying a live list races with the
       40-delta compaction and with trimOverlay()'s trim-by-count —
       a publish against a copied-but-not-identical list silently
       discards somebody's edits. The report below tells you whether
       anything still needs draining.
     - It never copies the stamp hash. An absent one reads as zero
       everywhere, every page sees a difference once, refreshes once,
       and carries on. That is a supported outcome.

     GET  /api/migrate?firm=modillion              dry run, reports only
     POST /api/migrate?firm=modillion&apply=1      does the copy

   Both need a signed-in person WITH A GRANT FOR THAT FIRM, and both
   need MIGRATE_SECRET set in the environment and sent as
   x-migrate-secret. The secret is not about secrecy — the token check
   already did that — it is so that no ordinary colleague can reach a
   key-rewriting endpoint by guessing a URL.
   ============================================================ */

import { requireUser } from "./_auth.js";
import { isFirm } from "./_firms.js";

const SETS = ["deals", "crm", "lps", "operators", "tasks", "competitors"];

const OLD_BASE    = set => "modillion:base:" + set;
const OLD_OVERLAY = set => "modillion:overlay:" + set;
const NEW_BASE    = (firm, set) => "modillion:" + firm + ":base:" + set;
const NEW_OVERLAY = (firm, set) => "modillion:" + firm + ":overlay:" + set;

function redisEnv() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
  };
}

async function redis(command) {
  const { url, token } = redisEnv();
  if (!url || !token) throw new Error("No Redis store configured.");
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error("Redis " + command[0] + " failed: HTTP " + r.status);
  const j = await r.json();
  if (j && j.error) throw new Error("Redis " + command[0] + ": " + j.error);
  return j ? j.result : null;
}

function size(v) { return v == null ? 0 : String(v).length; }

export default async function handler(req, res) {
  if (!process.env.MIGRATE_SECRET) {
    res.status(503).json({ error: "MIGRATE_SECRET is not set. This route is inert without it." });
    return;
  }
  const sent = req.headers["x-migrate-secret"] || "";
  if (sent !== process.env.MIGRATE_SECRET) {
    res.status(403).json({ error: "Bad or missing x-migrate-secret.", signIn: false });
    return;
  }

  const q = req.query || {};
  const user = await requireUser(req, res, q.firm);
  if (!user) return;
  if (!isFirm(user.firm)) { res.status(400).json({ error: "Unknown firm." }); return; }
  const firm = user.firm;

  const apply = req.method === "POST" && String(q.apply || "") === "1";

  try {
    /* SURVEY FIRST, ALWAYS — even on an apply, so the answer says what
       the world looked like at the moment it acted. */
    const report = [];
    for (const set of SETS) {
      const [oldBase, oldLen, newBase, newLen] = await Promise.all([
        redis(["GET", OLD_BASE(set)]),
        redis(["LLEN", OLD_OVERLAY(set)]),
        redis(["GET", NEW_BASE(firm, set)]),
        redis(["LLEN", NEW_OVERLAY(firm, set)])
      ]);
      report.push({
        set,
        from: { bytes: size(oldBase), queuedEdits: oldLen || 0 },
        to:   { bytes: size(newBase), queuedEdits: newLen || 0 },
        /* The gate. A destination that already holds a document is not
           overwritten — that is either a second run, or somebody has
           been using the new namespace already, and neither is a thing
           to resolve by clobbering it. */
        action: !oldBase ? "nothing-at-source"
              : newBase  ? "destination-not-empty-SKIPPED"
              : "copy",
        _oldBase: oldBase
      });
    }

    /* The drain check, and it is the one thing to read before applying.
       A non-zero count means somebody's edits are still sitting in the
       old overlay and have NOT been folded into the base this is about
       to copy. Publish those six sets from the dashboard first. */
    const undrained = report.filter(r => r.from.queuedEdits > 0).map(r => r.set);

    if (!apply) {
      res.status(200).json({
        ok: true, mode: "dry-run", firm,
        wouldCopy: report.filter(r => r.action === "copy").map(r => r.set),
        skipped: report.filter(r => r.action !== "copy").map(r => ({ set: r.set, why: r.action })),
        undrainedOverlays: undrained,
        advice: undrained.length
          ? "Publish these sets from the dashboard first, then re-run: " + undrained.join(", ")
          : "Nothing queued. Safe to apply.",
        detail: report.map(({ _oldBase, ...r }) => r)
      });
      return;
    }

    if (undrained.length) {
      res.status(409).json({
        ok: false, error: "Some sets still have queued edits. Publish them first.",
        undrainedOverlays: undrained
      });
      return;
    }

    const copied = [];
    for (const r of report) {
      if (r.action !== "copy") continue;
      await redis(["SET", NEW_BASE(firm, r.set), r._oldBase]);
      copied.push({ set: r.set, bytes: r.from.bytes });
    }

    res.status(200).json({
      ok: true, mode: "applied", firm, copied,
      skipped: report.filter(r => r.action !== "copy").map(r => ({ set: r.set, why: r.action })),
      note: "Old keys untouched — they are the rollback. Delete this route and MIGRATE_SECRET when done."
    });
  } catch (e) {
    res.status(502).json({ error: e.message || "Migration failed." });
  }
}
