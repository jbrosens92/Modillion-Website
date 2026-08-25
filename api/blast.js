/* ============================================================
   /api/blast — the news blast

   Does anybody write about us? Once a week this answers that in
   an email, and the answer is usually no. Two halves:

     SWEEP   run the watchlist, file what is new
     SEND    mail everything filed and unsent, mark it sent

   They are separate on purpose, and not for tidiness. A sweep is
   eight web-search-and-read passes; a send is one HTTP call. Put
   them in one invocation and the send inherits the sweep's failure
   modes and its clock — a slow Tuesday means no blast at all,
   rather than a blast of what the earlier passes did manage to
   find. Split, a half-finished sweep still mails what it got.

     GET  /api/blast                probe — what is configured
     GET  /api/blast?op=preview     the digest as it stands, unsent
     GET  /api/blast?op=sweep       sweep the stalest entries
     GET  /api/blast?op=send        send and mark sent
     POST /api/blast?op=sweep|send  same, by hand, with the write key

   GET carries the verbs because VERCEL CRON ONLY ISSUES GET. That
   is the platform's shape, not a preference.

   ------------------------------------------------------------
   WHY A SWEEP IS INCREMENTAL

   Eight entries at up to ninety seconds each does not fit in a
   serverless invocation, and a sweep that dies at the ceiling
   leaves no record of the six entries it did finish.

   So a sweep takes entries STALEST FIRST, files each one as it
   finishes, and stops starting new ones when the clock runs down.
   Cron fires it several times; the ordering guarantees every entry
   comes round. A run that is killed mid-entry loses that entry's
   work and nothing else, and the next run picks it up first
   because its lastSwept is still the oldest.

   ------------------------------------------------------------
   WHO CAN MAKE IT SEND

   Unlike /api/records, THIS ENDPOINT REFUSES TO RUN UNLOCKED.
   records.js tolerates an open write because the cost of an
   anonymous POST is a bad record somebody can fix. The cost here
   is the firm's return address in four inboxes, as often as a
   stranger cares to ask — and a sweep is billable model calls, so
   an open endpoint is also a way to spend somebody else's money.

   Either CRON_SECRET (what Vercel Cron sends) or
   DASHBOARD_WRITE_KEY (x-dashboard-key, as everywhere else) must
   be set. With neither, sweep and send return 503 saying so.
   PREVIEW stays open, matching the posture of reads elsewhere in
   this dashboard — a decision, not an oversight.
   ============================================================ */

import { createHash } from "node:crypto";
import { redisConfigured, readBase, readOverlay, appendOverlay, deepMerge } from "./_store.js";
import { sweepEntry, today, clip } from "./_news.js";
import { sendDigest, canSend } from "./notify.js";

export const maxDuration = 300;

/* Stop STARTING entries at four minutes, against a five-minute
   ceiling. The gap is one entry's worth of headroom: the check
   happens before a pass begins, and a pass that begins at 3:59
   still has to finish. */
const BUDGET_MS = 240_000;
const DEFAULT_PER_RUN = 4;

const SET = "mentions";

function mentionId(watchId, url) {
  return "m-" + createHash("sha1").update(watchId + "|" + url).digest("hex").slice(0, 12);
}

function authorized(req) {
  const cron = process.env.CRON_SECRET;
  const key = process.env.DASHBOARD_WRITE_KEY;
  if (!cron && !key) return null;                       // unlocked — refused above
  if (cron && req.headers.authorization === "Bearer " + cron) return true;
  if (key && req.headers["x-dashboard-key"] === key) return true;
  return false;
}

async function readDoc() {
  const [base, overlay] = await Promise.all([readBase(SET), readOverlay(SET)]);
  if (!base) return null;
  return deepMerge(base, overlay || {});
}

function watchlist(doc) {
  return (doc.watchlist || []).filter(w => w && w.id && w.active !== false);
}

function recipients(doc) {
  const fromEnv = String(process.env.BLAST_RECIPIENTS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : (doc.recipients || []);
}

/* ============================================================
   THE DIGEST

   Everything filed and not yet sent, grouped in watchlist order —
   which puts the entity entries, the ones that name us, above the
   beat sweeps. Inside a group, newest first; undated last, since
   an undated entity mention is still a real mention (it came with
   a quote) and only its position is uncertain.

   ONE URL APPEARS ONCE. A piece can legitimately name Modillion
   and belong on the Co-GP beat, and it is filed under both — the
   watchlist is the unit of record. But a reader who sees the same
   headline twice concludes the blast is broken, so the first
   group to claim a URL keeps it.
   ============================================================ */
function buildDigest(doc) {
  const all = doc.mentions || [];
  const unsent = all.filter(m => m && m.url && !m.sent);
  const byWatch = new Map();
  const claimed = new Set();

  unsent.forEach(m => {
    if (claimed.has(m.url)) return;
    claimed.add(m.url);
    if (!byWatch.has(m.watchId)) byWatch.set(m.watchId, []);
    byWatch.get(m.watchId).push(m);
  });

  const groups = [];
  const ids = [];
  let earliest = "", latest = "";

  watchlist(doc).forEach(w => {
    const items = (byWatch.get(w.id) || []).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
    if (!items.length) return;
    items.forEach(i => {
      ids.push(i.id);
      if (i.date) {
        if (!earliest || i.date < earliest) earliest = i.date;
        if (!latest || i.date > latest) latest = i.date;
      }
    });
    groups.push({ label: w.label, kind: w.kind, items: items });
  });

  const period = earliest && latest
    ? (earliest === latest ? earliest : earliest + " to " + latest)
    : "";

  const notes = [];
  const never = watchlist(doc).filter(w => !(doc.swept || {})[w.id]);
  if (never.length) {
    notes.push("Not yet swept: " + never.map(w => w.label).join(", ") + ".");
  }

  return { groups, ids, period, notes, count: ids.length };
}

/* ============================================================
   SWEEP
   ============================================================ */
async function sweep(doc, limit) {
  const swept = doc.swept || {};
  const known = new Set((doc.mentions || []).map(m => m.watchId + "|" + m.url));

  /* Stalest first — never-swept sorts before everything, since ""
     is less than any timestamp. This ordering is the whole reason
     a killed run is safe: the entry it dropped stays oldest. */
  const queue = watchlist(doc)
    .slice()
    .sort((a, b) => String(swept[a.id] || "").localeCompare(String(swept[b.id] || "")))
    .slice(0, Math.max(1, limit));

  const started = Date.now();
  const report = [];
  const filed = [];
  const stamps = {};

  for (const entry of queue) {
    if (Date.now() - started > BUDGET_MS) {
      report.push({ id: entry.id, label: entry.label, skipped: "out of time this run" });
      continue;
    }

    let found;
    try {
      found = await sweepEntry(entry, { maxItems: Number(process.env.BLAST_MAX_ITEMS || 6) });
    } catch (e) {
      // One entry failing is not the run failing. It keeps its old
      // lastSwept, so the next run takes it first.
      report.push({ id: entry.id, label: entry.label, error: clip(e && e.message, 200) });
      continue;
    }

    const fresh = [];
    for (const item of found.items) {
      const key = entry.id + "|" + item.url;
      if (known.has(key)) continue;
      known.add(key);
      fresh.push(Object.assign({
        id: mentionId(entry.id, item.url),
        watchId: entry.id,
        watchLabel: entry.label,
        kind: entry.kind,
        found: today()
      }, item));
    }

    filed.push(...fresh);
    stamps[entry.id] = new Date().toISOString();
    report.push({
      id: entry.id,
      label: entry.label,
      found: found.items.length,
      new: fresh.length,
      dropped: found.dropped,
      notes: found.notes
    });
  }

  /* One append for the whole run. RPUSH is atomic (see _store.js),
     so a sweep running beside somebody editing the watchlist cannot
     clobber them, and the merge unions by id. */
  if (filed.length || Object.keys(stamps).length) {
    await appendOverlay(SET, { mentions: filed, swept: stamps });
  }

  return {
    swept: report.filter(r => !r.skipped && !r.error).length,
    filed: filed.length,
    elapsedMs: Date.now() - started,
    entries: report
  };
}

/* ============================================================
   SEND

   AN EMPTY WEEK SENDS NOTHING. Silence is the accurate signal for
   a small private firm that was not in the news, and a weekly
   "no mentions this week" is how people learn to filter the
   sender. The probe and the preview are there for anyone who
   wants to confirm it ran.
   ============================================================ */
async function send(doc, dry) {
  const digest = buildDigest(doc);
  const to = recipients(doc);

  if (!digest.count) return { sent: false, why: "Nothing filed and unsent.", digest };
  if (!to.length) return { sent: false, why: "No recipients configured.", digest };
  if (!canSend()) return { sent: false, why: "No RESEND_API_KEY configured.", digest };
  if (dry) return { sent: false, why: "Dry run.", digest };

  const delivered = [];
  const failed = [];
  for (const addr of to) {
    try {
      const out = await sendDigest(addr, digest);
      delivered.push({ to: addr, id: out.id });
    } catch (e) {
      failed.push({ to: addr, error: clip(e && e.message, 200) });
    }
  }

  /* Mark sent only if it reached SOMEBODY. Marking on a total
     failure would retire the items unread; not marking after a
     partial success would mail the rest of the team the same
     digest again next week. Somebody got it — that is the event
     the log is recording. */
  if (delivered.length) {
    const at = new Date().toISOString();
    await appendOverlay(SET, {
      mentions: digest.ids.map(id => ({ id: id, sent: at })),
      lastSend: at,
      sends: [{
        id: "s-" + at,
        at: at,
        count: digest.count,
        to: delivered.map(d => d.to),
        failed: failed.map(f => f.to)
      }]
    });
  }

  return { sent: delivered.length > 0, delivered, failed, digest };
}

/* ============================================================ */
export default async function handler(req, res) {
  const allowed = process.env.DASHBOARD_ALLOWED_ORIGIN;
  if (allowed) {
    const origin = req.headers.origin || "";
    if (origin && origin !== allowed) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", allowed);
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dashboard-key, Authorization");
    res.status(204).end();
    return;
  }

  const q = req.query || {};
  const op = String(q.op || "").trim();

  res.setHeader("Cache-Control", "no-store");

  if (!op) {
    let counts = null;
    if (redisConfigured()) {
      try {
        const doc = await readDoc();
        if (doc) {
          const d = buildDigest(doc);
          counts = {
            watching: watchlist(doc).length,
            filed: (doc.mentions || []).length,
            unsent: d.count,
            lastSend: doc.lastSend || null,
            recipients: recipients(doc).length
          };
        }
      } catch (e) { /* the probe reports shape, not health */ }
    }
    res.status(200).json({
      ok: true,
      store: redisConfigured(),
      seeded: !!counts,
      research: !!process.env.ANTHROPIC_API_KEY,
      mail: canSend(),
      locked: !!(process.env.CRON_SECRET || process.env.DASHBOARD_WRITE_KEY),
      counts: counts
    });
    return;
  }

  if (!["sweep", "send", "preview"].includes(op)) {
    res.status(400).json({ error: "Unknown op.", ops: ["sweep", "send", "preview"] });
    return;
  }

  if (op !== "preview") {
    const ok = authorized(req);
    if (ok === null) {
      res.status(503).json({
        error: "Set CRON_SECRET or DASHBOARD_WRITE_KEY before this endpoint will sweep or send."
      });
      return;
    }
    if (!ok) {
      res.status(403).json({ error: "Not allowed." });
      return;
    }
  }

  if (!redisConfigured()) {
    res.status(503).json({ error: "No records store configured." });
    return;
  }

  try {
    const doc = await readDoc();
    if (!doc) {
      res.status(503).json({
        error: "The mentions set has never been seeded. Run: python3 tools/publish.py --only mentions"
      });
      return;
    }

    if (op === "preview") {
      const d = buildDigest(doc);
      res.status(200).json({
        ok: true,
        period: d.period,
        count: d.count,
        notes: d.notes,
        recipients: recipients(doc),
        groups: d.groups,
        swept: doc.swept || {},
        lastSend: doc.lastSend || null
      });
      return;
    }

    if (op === "sweep") {
      if (!process.env.ANTHROPIC_API_KEY) {
        res.status(503).json({ error: "No ANTHROPIC_API_KEY configured on the server." });
        return;
      }
      const limit = Number(q.limit) > 0 ? Number(q.limit) : DEFAULT_PER_RUN;
      const out = await sweep(doc, limit);
      res.status(200).json(Object.assign({ ok: true, op: "sweep" }, out));
      return;
    }

    const out = await send(doc, String(q.dry || "") === "1");
    res.status(200).json({
      ok: true,
      op: "send",
      sent: out.sent,
      why: out.why || null,
      delivered: out.delivered || [],
      failed: out.failed || [],
      count: out.digest.count,
      period: out.digest.period
    });
  } catch (e) {
    res.status(502).json({ error: clip(e && e.message, 300) || "The blast failed." });
  }
}
