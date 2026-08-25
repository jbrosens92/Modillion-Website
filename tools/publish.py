#!/usr/bin/env python3
"""
Publish the dashboard's data to the live site.

WHAT THIS REPLACES
Until now, making records or a refreshed document index visible to the
team meant: export the file from the dashboard, drop it in the site
folder, commit it, push it, wait for a deploy. Every person, every
time — and it only worked at all because the repository was private,
since those files carry real investor and sponsor names.

Now the data lives in Vercel storage and this script puts it there.
The repository holds code and nothing else.

WHAT IT SENDS, AND TO WHERE
    deals-data.json      -> POST /api/records?set=deals&op=publish
    crm-data.json        -> POST /api/records?set=crm&op=publish
    operator-data.json   -> POST /api/records?set=operators&op=publish
    tasks-data.json      -> POST /api/records?set=tasks&op=publish
    competitor-data.json -> POST /api/records?set=competitors&op=publish
    mentions-data.json   -> POST /api/records?set=mentions&op=publish

IT TALKS TO THE SITE, NOT TO THE STORE. This machine never holds the
Redis credentials — only DASHBOARD_WRITE_KEY, and only if the
endpoints are locked. The one place that speaks to the store is the
server, where the credentials already live.

PUBLISHING REPLACES THE BASE AND CLEARS THE SHARED EDITS, because the
file being sent already contains them. Send a STALE export and you
will roll the team back to it. The safe source is the dashboard's own
"Download" button, taken moments before — or better, use the
dashboard's "Publish to team" button instead, which sends what is on
screen and cannot be out of date. This script is for the initial seed.

USAGE
    python3 tools/publish.py                      # everything
    python3 tools/publish.py --only deals         # just the pipeline
    python3 tools/publish.py --only crm operators # just those record sets
    python3 tools/publish.py --site https://www.modillionpartners.com
    python3 tools/publish.py --dry-run            # say what would be sent

ENVIRONMENT
    MODILLION_SITE         default https://www.modillionpartners.com
    DASHBOARD_WRITE_KEY    only needed if the endpoints are locked
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_SITE = "https://www.modillionpartners.com"

# name -> (local file, path on the site, what to call it in output)
TARGETS = {
    "deals":     ("deals-data.json",     "/api/records?set=deals&op=publish",     "deal pipeline"),
    "crm":       ("crm-data.json",       "/api/records?set=crm&op=publish",       "investor CRM"),
    "operators": ("operator-data.json",  "/api/records?set=operators&op=publish", "operator CRM"),
    "tasks":     ("tasks-data.json",     "/api/records?set=tasks&op=publish",     "task list"),
    "competitors": ("competitor-data.json", "/api/records?set=competitors&op=publish",
                    "competitor tracker"),
    "mentions":  ("mentions-data.json",  "/api/records?set=mentions&op=publish",
                    "news blast watchlist"),
}

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def post(url, payload, key):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["x-dashboard-key"] = key
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
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


def describe(name, doc):
    """A one-line count, so a truncated or empty file is obvious before
    it overwrites what the team is using."""
    if name == "deals":
        deals = doc.get("deals") or []
        with_debt = sum(1 for d in deals if d.get("debt"))
        return "%d deals, %d with debt" % (len(deals), with_debt)
    if name == "competitors":
        rows = doc.get("competitors") or []
        articles = sum(len(c.get("articles") or []) for c in rows)
        return "%d competitors, %d articles" % (len(rows), articles)
    if name == "mentions":
        watch = doc.get("watchlist") or []
        found = doc.get("mentions") or []
        # Publishing REPLACES the base and drops the deltas it accounts
        # for, and every mention the sweep has filed lives in those
        # deltas. Re-seeding from the local file after the blast has run
        # therefore discards what it found. Say the count out loud so a
        # zero here is read before it is sent, not after.
        return "%d watch entries, %d mentions in this file" % (len(watch), len(found))
    for field in ("investors", "operators", "tasks"):
        if isinstance(doc.get(field), list):
            return "%d %s" % (len(doc[field]), field)
    return "%d top-level keys" % len(doc)


def main():
    ap = argparse.ArgumentParser(description="Publish dashboard data to the live site.")
    ap.add_argument("--site", default=os.environ.get("MODILLION_SITE", DEFAULT_SITE),
                    help="site root, default %s" % DEFAULT_SITE)
    ap.add_argument("--only", nargs="+", choices=sorted(TARGETS),
                    help="publish only these; default is every set")
    ap.add_argument("--dry-run", action="store_true",
                    help="read and check the files, send nothing")
    args = ap.parse_args()

    site = args.site.rstrip("/")
    key = os.environ.get("DASHBOARD_WRITE_KEY", "")
    names = args.only or list(TARGETS)

    print("Publishing to %s" % site)
    if not key:
        print("No DASHBOARD_WRITE_KEY set — fine if the endpoints are unlocked, "
              "a 403 below if they are not.")
    print()

    failures = 0
    for name in names:
        filename, path, label = TARGETS[name]
        local = os.path.join(HERE, filename)

        if not os.path.exists(local):
            print("  SKIP  %-15s %s not found" % (label, filename))
            continue
        try:
            with open(local, encoding="utf-8") as fh:
                doc = json.load(fh)
        except ValueError as e:
            print("  FAIL  %-15s %s is not valid JSON — %s" % (label, filename, e))
            failures += 1
            continue

        size = os.path.getsize(local)
        summary = describe(name, doc)

        if args.dry_run:
            print("  would send %-15s %s  (%s, %.1f KB)" % (label, filename, summary, size / 1024.0))
            continue

        payload = {"doc": doc, "by": "tools/publish.py"}
        ok, result = post(site + path, payload, key)
        if ok:
            print("  OK    %-15s %s  (%s, %.1f KB)" % (label, filename, summary, size / 1024.0))
        else:
            print("  FAIL  %-15s %s" % (label, result))
            failures += 1

    print()
    if args.dry_run:
        print("Dry run — nothing was sent.")
    elif failures:
        print("%d of %d failed." % (failures, len(names)))
        sys.exit(1)
    else:
        print("Published. The dashboard picks it up on the next load; no deploy needed.")


if __name__ == "__main__":
    main()
