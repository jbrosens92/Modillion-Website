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

   NEITHER THE STORE NOR THE ENDPOINT IS AUTHENTICATED.
   /api/records answers anyone who asks. This file decides where the
   data lives and who can lose it; it does not decide who can read
   it. That remains the separate, deferred piece of work.

   ------------------------------------------------------------
   WHY THE REPOSITORY CAN BE PUBLIC

   The JSON files were briefly committed, which forced the repo
   private and left a standing hazard: make it public again without
   purging history and every investor name is published. With the
   data here instead, git holds code and nothing else, and that
   hazard stops existing rather than being managed.
   ============================================================ */

const KEY = (kind, set) => "modillion:" + kind + ":" + set;

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

function parse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

/* The base document — the same shape crm-data.json has on disk.
   Seeded by tools/publish.py and replaced by a "fold" (see
   /api/records), never edited in place. */
export async function readBase(set) {
  return parse(await redis(["GET", KEY("base", set)]), null);
}

export async function writeBase(set, doc) {
  await redis(["SET", KEY("base", set), JSON.stringify(doc)]);
  return doc;
}

/* ONE APPEND, AND THAT IS THE WHOLE CONCURRENCY STORY. RPUSH is
   atomic, so two people saving at the same instant produce two list
   entries rather than one overwriting the other. Nothing is read
   first, so there is nothing to read stale. */
export async function appendOverlay(set, delta) {
  const len = await redis(["RPUSH", KEY("overlay", set), JSON.stringify(delta)]);
  if (typeof len === "number" && len >= COMPACT_AT) {
    // Housekeeping, and deliberately best-effort: a failure here
    // costs a longer list, not an edit.
    try { await compactOverlay(set); } catch (e) { /* leave it long */ }
  }
  return len;
}

function fold(items) {
  return (items || []).reduce((acc, raw) => deepMerge(acc, parse(raw, {})), {});
}

/* Fold the deltas in insertion order. The merge is a union, so the
   only thing order decides is which value wins when two people set
   the SAME field — and insertion order is the right answer to that. */
export async function readOverlay(set) {
  return fold(await redis(["LRANGE", KEY("overlay", set), "0", "-1"]));
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

export async function compactOverlay(set) {
  const k = KEY("overlay", set);
  const items = await redis(["LRANGE", k, "0", "-1"]);
  if (!items || items.length < 2) return null;
  const folded = fold(items);
  await redis(["EVAL", LUA_COMPACT, "1", k, String(items.length), JSON.stringify(folded)]);
  return folded;
}

export async function clearOverlay(set) {
  await redis(["DEL", KEY("overlay", set)]);
}

/* How many deltas are queued right now. Handed to the page on a read so
   that a later publish can say how much of the queue its document
   actually accounts for. */
export async function overlayLength(set) {
  const n = await redis(["LLEN", KEY("overlay", set)]);
  return typeof n === "number" ? n : 0;
}

/* Drop the first N deltas and keep the rest — the same LTRIM that makes
   compactOverlay() safe, for the same reason. Publishing used to DEL the
   whole list, which is correct only if nothing was appended between the
   page merging its document and the server acting on it. Nobody noticed
   while publishing was a button somebody pressed now and then; on a timer
   it becomes a routine way to lose a colleague's edit. Trimming exactly
   what the page had seen leaves anything newer queued for next time. */
export async function trimOverlay(set, n) {
  const k = KEY("overlay", set);
  if (!(n > 0)) return;
  await redis(["LTRIM", k, String(n), "-1"]);
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
