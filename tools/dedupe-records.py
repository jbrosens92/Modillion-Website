#!/usr/bin/env python3
"""
Remove records that appear twice under the same id.

WHY THIS EXISTS
Operators.rebuild() and Competitors.rebuild() used to build their list by
concatenating the published base with this browser's own overlay.created,
with nothing checking whether a record was in both. A record created in one
browser and then published is in both: the browser that pressed Publish has
its overlay cleared by adoptPublished(), and nobody else's is.

The colleague still holding a copy sees the record twice. Worse, toFile()
exports what is merged, so the NEXT publish from that browser writes both
copies into the shared base and the duplicate becomes everyone's. Two
operators reached the live records this way — Invictus Real Estate Partners
and Old Three Hundred Capital.

The guard is in the page now. This is for the gap after it: a browser still
running the older page can publish duplicates until it is reloaded, and this
takes them back out without anybody having to find them by eye.

WHAT IT DOES
Reads the published base for a set, keeps the FIRST record of each id, and
publishes the result. Identical duplicates lose nothing. Records that share
an id but differ are NOT touched — that is a merge, not a de-duplication,
and it needs a person. They are reported and left alone.

It does not touch records that are genuinely two firms under two names.
OTH and Old Three Hundred Capital are the same firm under two records with
DIFFERENT ids, which is a data decision and not this script's business.

    python3 tools/dedupe-records.py --set operators --dry-run
    python3 tools/dedupe-records.py --set operators
    python3 tools/dedupe-records.py --set operators --backup-dir .

PUBLISHING REPLACES THE BASE AND DROPS THE SHARED EDITS it accounts for, so
this writes a timestamped backup of what it read before sending anything.

ENVIRONMENT
    MODILLION_SITE         default https://www.modillionpartners.com
    DASHBOARD_WRITE_KEY    only needed if the endpoints are locked
"""

import argparse
import datetime
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_SITE = "https://www.modillionpartners.com"

# set name -> (the list inside the document, what to call one)
SETS = {
    "operators":   ("operators",   "operator"),
    "competitors": ("competitors", "competitor"),
    "crm":         ("investors",   "investor"),
    "deals":       ("deals",       "deal"),
    "tasks":       ("tasks",       "task"),
    "mentions":    ("mentions",    "mention"),
}


def call(url, key, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("x-dashboard-key", key)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return True, json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("error", detail)
        except ValueError:
            pass
        return False, "HTTP %d — %s" % (e.code, detail)
    except Exception as e:                                  # noqa: BLE001
        return False, str(e)


def main():
    ap = argparse.ArgumentParser(description="Remove same-id duplicate records.")
    ap.add_argument("--set", required=True, choices=sorted(SETS))
    ap.add_argument("--site", default=os.environ.get("MODILLION_SITE", DEFAULT_SITE))
    ap.add_argument("--dry-run", action="store_true", help="say what would go, send nothing")
    ap.add_argument("--backup-dir", default=".", help="where to write the before copy")
    args = ap.parse_args()

    site = args.site.rstrip("/")
    key = os.environ.get("DASHBOARD_WRITE_KEY", "")
    field, noun = SETS[args.set]

    ok, got = call("%s/api/records?set=%s" % (site, args.set), key)
    if not ok:
        print("Could not read: %s" % got, file=sys.stderr)
        return 1

    base = got.get("base") or {}
    rows = base.get(field) or []
    overlay = got.get("overlay") or {}
    print("Read %d %ss from %s" % (len(rows), noun, site))
    if overlay:
        print("  NOTE: the shared overlay is not empty (%s)." % ", ".join(sorted(overlay)))
        print("        Publishing drops the deltas it accounts for. Check with the team first.")

    seen, kept, dropped, conflicts = {}, [], [], []
    for rec in rows:
        rid = rec.get("id")
        if rid is None:
            kept.append(rec)
            continue
        if rid in seen:
            if json.dumps(rec, sort_keys=True) == json.dumps(seen[rid], sort_keys=True):
                dropped.append(rec)
            else:
                # Same id, different content. Merging is a person's job.
                conflicts.append(rec)
                kept.append(rec)
            continue
        seen[rid] = rec
        kept.append(rec)

    for rec in dropped:
        print("  drop  %-40s (identical copy of id %s)"
              % (rec.get("name") or rec.get("title") or "?", rec.get("id")))
    for rec in conflicts:
        print("  KEPT  %-40s (id %s appears twice and the copies DIFFER — merge by hand)"
              % (rec.get("name") or rec.get("title") or "?", rec.get("id")))

    if not dropped:
        print("Nothing to remove.")
        return 0

    stamp = datetime.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    backup = os.path.join(args.backup_dir, "%s-data.before-dedupe-%s.json" % (
        "operator" if args.set == "operators" else args.set, stamp))
    with open(backup, "w") as fh:
        json.dump(base, fh, indent=2)
    print("Backed up what was read to %s" % backup)

    if args.dry_run:
        print("Dry run — nothing sent. Would go from %d to %d." % (len(rows), len(kept)))
        return 0

    doc = dict(base)
    doc[field] = kept
    ok, out = call("%s/api/records?set=%s&op=publish" % (site, args.set), key,
                   {"doc": doc, "by": "dedupe-records.py"})
    if not ok:
        print("Publish failed: %s" % out, file=sys.stderr)
        return 1
    print("Published. %d %ss, was %d." % (len(kept), noun, len(rows)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
