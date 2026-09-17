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
    MODILLION_TOKEN        required — a dashboard session token, see below

MODILLION_TOKEN — HOW THESE TOOLS AUTHENTICATE NOW (changed 2026-09-15)

The endpoints used to be open, or locked by DASHBOARD_WRITE_KEY, which was one
shared string. Both are gone: /api/records now requires a real
signed-in person, so these scripts need a session token too.

Getting one takes about ten seconds and it is deliberately manual. Automating it
would mean putting a colleague's password in a script or a CI secret, which is
exactly the kind of standing credential this work removed:

    1. Sign in to the dashboard in a browser, as you normally would.
    2. Open dev tools -> Application -> Local Storage -> the site.
    3. Copy the access_token out of the "modillion-session" entry.
    4. export MODILLION_TOKEN='eyJ...'

IT EXPIRES IN ABOUT AN HOUR. That is not a defect to work around: these are
seeding and repair tools run by hand a few times a year, and a credential on
this machine that expires on its own is the right trade. If it has gone stale
mid-run the script says 401 and you repeat the four steps above.

DO NOT paste a Supabase service-role key here instead. It would work, and it
would be a key that bypasses every check, sitting in a shell history.
"""

import argparse
import datetime
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_SITE = "https://www.modillionpartners.com"

# Kept in step with api/_firms.js by hand; the server refuses an id it does
# not know, so drift here fails loudly rather than writing somewhere odd.
FIRMS = ("modillion", "fairwind")

# set name -> (the list inside the document, what to call one)
SETS = {
    "operators":   ("operators",   "operator"),
    "competitors": ("competitors", "competitor"),
    "crm":         ("investors",   "investor"),
    "deals":       ("deals",       "deal"),
    "tasks":       ("tasks",       "task"),
}


def call(url, key, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("Authorization", "Bearer " + key)
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
    # Required and without a default, for the same reason as publish.py: this
    # script ends in a publish, which replaces a base document and drops the
    # overlay behind it. The wrong firm is another firm's records rewritten.
    ap.add_argument("--firm", required=True, choices=sorted(FIRMS),
                    help="which firm's records to dedupe (no default, on purpose)")
    ap.add_argument("--site", default=os.environ.get("MODILLION_SITE", DEFAULT_SITE))
    ap.add_argument("--dry-run", action="store_true", help="say what would go, send nothing")
    ap.add_argument("--backup-dir", default=".", help="where to write the before copy")
    args = ap.parse_args()

    site = args.site.rstrip("/")
    key = os.environ.get("MODILLION_TOKEN", "")
    field, noun = SETS[args.set]

    ok, got = call("%s/api/records?set=%s&firm=%s" % (site, args.set, args.firm), key)
    if not ok:
        print("Could not read: %s" % got, file=sys.stderr)
        return 1

    base = got.get("base") or {}
    rows = base.get(field) or []
    overlay = got.get("overlay") or {}
    print("Read %d %ss from %s (%s)" % (len(rows), noun, site, args.firm))
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
    ok, out = call("%s/api/records?set=%s&firm=%s&op=publish" % (site, args.set, args.firm), key,
                   {"doc": doc, "by": "dedupe-records.py"})
    if not ok:
        print("Publish failed: %s" % out, file=sys.stderr)
        return 1
    print("Published. %d %ss, was %d." % (len(kept), noun, len(rows)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
