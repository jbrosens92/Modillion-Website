/* ============================================================
   api/_store.js — where the dashboard's data actually lives

   Underscore-prefixed on purpose: Vercel turns every file in /api
   into a route, except ones beginning with "_". This is a helper,
   not an endpoint.

   ONE STORE, UPSTASH REDIS

   Four record sets — deals, investors, operators, tasks — about
   35 KB in total, edited by hand through the dashboard and written
   by several people at once. They are not files, and Redis is the
   right shape for them for two reasons that were REAL DEFECTS in
   the Vercel Blob version this replaces:

     a) A Blob object has a PUBLIC URL that never changes. Nothing
        handed it to the browser, but it was reachable by anyone who
        learned it, and it would have kept answering from OUTSIDE
        any sign-in wall added later — a gate that looks like it
        protects records while the store sits open beside it. Redis
        has no public object URL.

     b) Read-modify-write over a blob loses concurrent writes. See
        appendOverlay(): edits are RPUSHed onto a list, which is
        atomic, so simultaneous writers cannot clobber each other at
        all. That is not a narrowed race. There is none.

   There was a second store — Vercel Blob, holding a 244 KB index of
   997 document names. The document mirror was retired on 2026-08-20
   (see README.txt) and the blob went with it. Nothing here reads a
   folder or stores a file.

   WHO CAN READ IS DECIDED ELSEWHERE — _auth.js verifies the person
   and _firms.js decides which firm they may reach. This file decides
   where the data lives and who can lose it.

   What it DOES enforce is that a firm id is present and real before
   any key is built. Since the dashboard went multi-tenant the firm is
   a permission boundary, and the failure mode without that check is
   silent rather than loud — see KEY() below, and store() at the
   bottom, which is the only way in.

   ------------------------------------------------------------
   WHY THE REPOSITORY CAN BE PUBLIC

   The JSON files were briefly committed, which forced the repo
   private and left a standing hazard: make it public again without
   purging history and every investor name is published. With the
   data here instead, git holds code and nothing else, and that
   hazard stops existing rather than being managed.
   ============================================================ */

import { isFirm } from "./_firms.js";

/* ============================================================
   THE KEY, AND WHY IT THROWS

   `modillion:` is the APPLICATION namespace — the product, not the
   tenant. The firm is the segment after it, so Modillion's own
   records read `modillion:modillion:base:crm`. That is momentarily
   odd to look at and it is the right shape: one rule, no exception
   carved out for the firm that happened to be here first.

   IT THROWS ON AN UNREGISTERED FIRM, and that single line is the
   most valuable one in the multi-tenant change. Without it, a firm
   that failed to arrive builds `modillion:undefined:base:crm` — a
   perfectly valid key, which reads back null. The page then shows an
   empty CRM, and thirty seconds later AutoPublish writes the whole
   document into it. Nothing throws, nothing logs, and the failure is
   discovered when somebody asks where the records went.

   A 500 is a much better day than that.
   ============================================================ */
const KEY = (kind, firm, set) => {
  if (!isFirm(firm)) throw new Error("Refusing to build a key for an unknown firm: " + String(firm));
  return "modillion:" + firm + ":" + kind + ":" + set;
};

/* How many overlay deltas accumulate before a write folds them into
   one. Purely housekeeping — a folded list and a long one read the
   same, this just stops LRANGE growing without bound. */
const COMPACT_AT = 40;

/* ============================================================
   UPSTASH REDIS — the records

   Spoken to over its REST API with plain fetch, so there is no
   package to install and nothing to keep in step with a lockfile.
   Vercel's Upstash integration injects KV_REST_API_*; a direct
   Upstash project injects UPSTASH_REDIS_REST_*. Both are accepted
   because which one you get depends on how the store was created,
   and that is not worth a support conversation later.
   ============================================================ */

function redisEnv() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
  };
}

export function redisConfigured() {
  const e = redisEnv();
  return !!(e.url && e.token);
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

/* Several commands, one HTTP round trip. Upstash's REST API takes an
   array of command arrays at /pipeline and answers with one result per
   command, in order. The live poll asks for every set's change stamp at
   once, and this is what keeps that ONE request rather than six — which
   is the difference between a poll that can run every few seconds and
   one that cannot. */
async function redisPipeline(commands) {
  const { url, token } = redisEnv();
  if (!url || !token) throw new Error("No Redis store configured.");
  const r = await fetch(url.replace(/\/+$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error("Redis pipeline failed: HTTP " + r.status);
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error("Redis pipeline: unexpected answer.");
  // One entry per command. An individual failure reads as null rather than
  // throwing the whole batch away — a missing stamp is simply "unknown".
  return j.map(x => (x && x.error) ? null : (x ? x.result : null));
}

function parse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

/* ============================================================
   THE CHANGE STAMP — what makes a live poll affordable

   One integer per set, bumped by every append and every fold. A
   page that remembers the stamp it last read can ask "has anything
   moved?" without pulling a 35 KB document to discover that nothing
   has.

   ALL SIX OF A FIRM'S LIVE IN ONE HASH, and that is a billing
   decision as much as a tidiness one. Upstash charges by the command, not by the
   request, so six GETs pipelined into one HTTP call is still six
   commands. HGETALL is one. At a two-second poll with four people
   that is the difference between roughly 350,000 commands a day and
   under 60,000 — which is what makes a poll this fast reasonable to
   leave running all day.

   It is not a version anybody can reason about and it is not
   ordered against anything else. It changes when the set changes.
   That is the only property asked of it. Nothing persists across a
   flush either: an empty hash reads as zero everywhere, every page
   sees a difference once, refreshes once, and carries on.
   ============================================================ */
/* ONE HASH PER FIRM, and it must stay that way. This was a module
   constant — a single `modillion:stamps` shared by everything — and
   leaving it that way through the multi-tenant change would have kept
   working while being wrong: every firm's page would refetch whenever
   any other firm saved, and readStamps() would hand each firm a
   per-minute readout of how busy the others are. The constant is gone
   rather than merely unused, so nothing can reference it by accident.

   The billing property the comment above describes is untouched: this
   is still ONE HGETALL per poll, just against a smaller hash. */
const stampHash = firm => {
  if (!isFirm(firm)) throw new Error("Refusing to build a stamp key for an unknown firm: " + String(firm));
  return "modillion:" + firm + ":stamps";
};

async function readStamps(firm, sets) {
  const list = (sets || []).slice();
  const out = {};
  if (!list.length) return out;
  /* HGETALL comes back as an object from Upstash's REST API, and as a
     flat [field, value, field, value] array from some clients. Both are
     accepted because which one you get is not worth a bug later. */
  const raw = await redis(["HGETALL", stampHash(firm)]);
  const got = {};
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) got[raw[i]] = raw[i + 1];
  } else if (raw && typeof raw === "object") {
    Object.assign(got, raw);
  }
  list.forEach(s => { out[s] = Number(got[s]) || 0; });
  return out;
}

/* The base document — the same shape crm-data.json has on disk.
   Seeded by tools/publish.py and replaced by a "fold" (see
   /api/records), never edited in place. */
async function readBase(firm, set) {
  return parse(await redis(["GET", KEY("base", firm, set)]), null);
}

async function writeBase(firm, set, doc) {
  // Stamped in the same round trip, so a fold is never visible to the
  // poll before the poll can tell that it happened.
  await redisPipeline([
    ["SET", KEY("base", firm, set), JSON.stringify(doc)],
    ["HINCRBY", stampHash(firm), set, 1]
  ]);
  return doc;
}

/* ONE APPEND, AND THAT IS THE WHOLE CONCURRENCY STORY. RPUSH is
   atomic, so two people saving at the same instant produce two list
   entries rather than one overwriting the other. Nothing is read
   first, so there is nothing to read stale. */
async function appendOverlay(firm, set, delta) {
  /* RPUSH and the stamp together. The append is still the atomic thing
     that matters; INCR rides along so no edit can sit in the list
     unannounced. Returns the list length, which is what decides when a
     fold is due. */
  const [len] = await redisPipeline([
    ["RPUSH", KEY("overlay", firm, set), JSON.stringify(delta)],
    ["HINCRBY", stampHash(firm), set, 1]
  ]);
  if (typeof len === "number" && len >= COMPACT_AT) {
    // Housekeeping, and deliberately best-effort: a failure here
    // costs a longer list, not an edit.
    try { await compactOverlay(firm, set); } catch (e) { /* leave it long */ }
  }
  return len;
}

function fold(items) {
  return (items || []).reduce((acc, raw) => deepMerge(acc, parse(raw, {})), {});
}

/* Fold the deltas in insertion order. The merge is a union, so the
   only thing order decides is which value wins when two people set
   the SAME field — and insertion order is the right answer to that. */
async function readOverlay(firm, set) {
  return fold(await redis(["LRANGE", KEY("overlay", firm, set), "0", "-1"]));
}

/* Drop the N entries we just folded and push the folded result in
   their place, as ONE atomic step.

   It has to be atomic and it has to be exactly N. Doing it as a DEL
   followed by an RPUSH would let a reader land in the gap and see an
   empty overlay — every edit apparently withdrawn at once. Trimming
   blindly would silently discard any delta pushed while the fold was
   being computed, which is somebody's save. LTRIM(n, -1) removes
   precisely the entries that went into the fold and keeps whatever
   arrived after them. */
const LUA_COMPACT =
  "redis.call('LTRIM', KEYS[1], tonumber(ARGV[1]), -1) " +
  "redis.call('LPUSH', KEYS[1], ARGV[2]) " +
  "return 1";

async function compactOverlay(firm, set) {
  const k = KEY("overlay", firm, set);
  const items = await redis(["LRANGE", k, "0", "-1"]);
  if (!items || items.length < 2) return null;
  const folded = fold(items);
  await redis(["EVAL", LUA_COMPACT, "1", k, String(items.length), JSON.stringify(folded)]);
  return folded;
}

async function clearOverlay(firm, set) {
  await redis(["DEL", KEY("overlay", firm, set)]);
}

/* How many deltas are queued right now. Handed to the page on a read so
   that a later publish can say how much of the queue its document
   actually accounts for. */
async function overlayLength(firm, set) {
  const n = await redis(["LLEN", KEY("overlay", firm, set)]);
  return typeof n === "number" ? n : 0;
}

/* Drop the first N deltas and keep the rest — the same LTRIM that makes
   compactOverlay() safe, for the same reason. Publishing used to DEL the
   whole list, which is correct only if nothing was appended between the
   page merging its document and the server acting on it. Nobody noticed
   while publishing was a button somebody pressed now and then; on a timer
   it becomes a routine way to lose a colleague's edit. Trimming exactly
   what the page had seen leaves anything newer queued for next time. */
async function trimOverlay(firm, set, n) {
  const k = KEY("overlay", firm, set);
  if (!(n > 0)) return;
  await redis(["LTRIM", k, String(n), "-1"]);
}

/* ============================================================
   store(firm) — THE ONLY WAY IN, AND WHY IT IS A CLOSURE

   Everything above is module-private. A handler gets its nine
   operations by naming a firm ONCE, and every call after that is
   bound to it.

   The obvious alternative was to export the functions with `firm` as
   a leading parameter. It would work, and it would be wrong in a way
   worth spelling out: /api/records makes eight store calls across
   five distinct functions, each of which builds its own key. That is
   eight independent chances to pass the wrong variable — and the
   consequences are not symmetrical. Forget it on a read and somebody
   sees an empty CRM. Forget it on compactOverlay() and forty of
   ANOTHER firm's deltas get folded into one entry: cross-boundary
   data loss, triggered by volume rather than by any particular
   action, so it will not happen in testing and it has no undo.

   A closure removes the class. Inside a handler there is no second
   firm in scope to pass by mistake.

   The firm is validated here rather than at every call, so an
   unregistered id fails at the top of the request with a name in the
   message — not eight calls later inside a Redis command.
   ============================================================ */
export function store(firm) {
  if (!isFirm(firm)) throw new Error("No store for an unknown firm: " + String(firm));
  return {
    firm,
    readStamps:    sets        => readStamps(firm, sets),
    readBase:      set         => readBase(firm, set),
    writeBase:     (set, doc)  => writeBase(firm, set, doc),
    appendOverlay: (set, delta) => appendOverlay(firm, set, delta),
    readOverlay:   set         => readOverlay(firm, set),
    compactOverlay: set        => compactOverlay(firm, set),
    clearOverlay:  set         => clearOverlay(firm, set),
    overlayLength: set         => overlayLength(firm, set),
    trimOverlay:   (set, n)    => trimOverlay(firm, set, n)
  };
}

/* ============================================================
   THE MERGE

   WHY A UNION IS THE RIGHT ANSWER, AND ITS ONE COST

   The overlays were already built as patches keyed by record id,
   with DELETIONS RECORDED AS TOMBSTONES rather than as missing keys
   — removed[id] = true, convRemoved, dealsHidden, an alias marked
   { forgotten: true }. That was done so a newer crm-data.json could
   be re-loaded without resurrecting things people had withdrawn.

   It pays off twice. Because every edit — including every delete —
   is an ADDITION, merging two overlays is a union, and a union needs
   no locking, no version vector and no conflict UI. Last-write-wins
   applies per FIELD rather than to the whole file, so the worst case
   is one person's value for one field, not one person's afternoon.

   THE COST: an overlay only ever grows. A key removed locally comes
   back on the next merge, because "absent" is not a statement this
   format can make — only a tombstone is. That is correct for
   withdrawing a record and wrong for undoing one, which is why there
   is no undo. Say so before adding one.

   KEEP THIS IDENTICAL TO SharedOverlay.merge IN dashboard.html. The
   server folds other people's edits with one rule; if the page folds
   them with another, the two disagree about what was deleted.
   ============================================================ */

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/* Union by id, falling back to value equality for arrays of scalars.
   Overlay arrays — `created`, `dealsAdded` — hold records carrying an
   id, so the same record edited by two people converges into one
   entry instead of appearing twice. */
function mergeArrays(a, b) {
  const out = Array.isArray(a) ? a.slice() : [];
  const at = new Map();
  out.forEach((v, i) => { if (isPlainObject(v) && v.id != null) at.set(v.id, i); });

  (Array.isArray(b) ? b : []).forEach(v => {
    if (isPlainObject(v) && v.id != null) {
      if (at.has(v.id)) out[at.get(v.id)] = deepMerge(out[at.get(v.id)], v);
      else { at.set(v.id, out.length); out.push(v); }
    } else if (!out.includes(v)) {
      out.push(v);
    }
  });
  return out;
}

export function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return mergeArrays(a, b);
  if (isPlainObject(a) && isPlainObject(b)) {
    const out = {};
    Object.keys(a).forEach(k => { out[k] = a[k]; });
    Object.keys(b).forEach(k => { out[k] = (k in out) ? deepMerge(out[k], b[k]) : b[k]; });
    return out;
  }
  return b === undefined ? a : b;
}
