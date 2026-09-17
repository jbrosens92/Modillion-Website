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
Files are read from firms/<firm>/ and sent to that firm's records:
    firms/<firm>/deals-data.json      -> POST ...?set=deals&firm=<firm>&op=publish
    firms/<firm>/crm-data.json        -> POST ...?set=crm&firm=<firm>&op=publish
    firms/<firm>/lp-data.json         -> POST ...?set=lps&firm=<firm>&op=publish
    firms/<firm>/operator-data.json   -> POST ...?set=operators&firm=<firm>&op=publish
    firms/<firm>/tasks-data.json      -> POST ...?set=tasks&firm=<firm>&op=publish
    firms/<firm>/competitor-data.json -> POST ...?set=competitors&firm=<firm>&op=publish

--firm IS REQUIRED AND HAS NO DEFAULT. Publishing replaces a set's base
document and drops the overlay behind it, so the wrong firm here is not a
misfiled copy — it is another firm's records overwritten and their queued
edits discarded. A default would put that one typo away.

IT TALKS TO THE SITE, NOT TO THE STORE. This machine never holds the
Redis credentials — only MODILLION_TOKEN, and only if the
endpoints are locked. The one place that speaks to the store is the
server, where the credentials already live.

PUBLISHING REPLACES THE BASE AND CLEARS THE SHARED EDITS, because the
file being sent already contains them. Send a STALE export and you
will roll the team back to it. The safe source is the dashboard's own
"Download" button, taken moments before — or better, use the
dashboard's "Publish to team" button instead, which sends what is on
screen and cannot be out of date. This script is for the initial seed.

USAGE
    python3 tools/publish.py --firm modillion                   # everything
    python3 tools/publish.py --firm fairwind --only deals       # just the pipeline
    python3 tools/publish.py --firm modillion --only crm operators
    python3 tools/publish.py --firm modillion --site https://www.modillionpartners.com
    python3 tools/publish.py --firm modillion --dry-run         # say what would be sent

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
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_SITE = "https://www.modillionpartners.com"

# The firms this script will publish to. Kept in step with api/_firms.js by
# hand — there is no import across the language boundary, and the server
# refuses an id it does not know, so a drift here fails loudly rather than
# writing somewhere unexpected.
FIRMS = ("modillion", "fairwind")

# name -> (local file, set name, what to call it in output)
TARGETS = {
    "deals":     ("deals-data.json",     "deals",     "deal pipeline"),
    "crm":       ("crm-data.json",       "crm",       "investor CRM"),
    # LPs for our partners and deals — the capital partner beside us on a
    # deal. Deliberately not part of "crm", which is LPs for the firm itself.
    "lps":       ("lp-data.json",        "lps",       "LP CRM"),
    "operators": ("operator-data.json",  "operators", "operator CRM"),
    "tasks":     ("tasks-data.json",     "tasks",     "task list"),
    "competitors": ("competitor-data.json", "competitors", "competitor tracker"),
}


def publish_path(set_name, firm):
    return "/api/records?set=%s&firm=%s&op=publish" % (set_name, firm)


def firm_dir(firm):
    """Seed files live under firms/<id>/ — one folder per firm, no exception
    for the firm that happened to be here first."""
    return os.path.join(HERE, "firms", firm)

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def post(url, payload, key):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
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
    for field in ("investors", "operators", "tasks"):
        if isinstance(doc.get(field), list):
            return "%d %s" % (len(doc[field]), field)
    return "%d top-level keys" % len(doc)


def main():
    ap = argparse.ArgumentParser(description="Publish dashboard data to the live site.")
    # REQUIRED, AND DELIBERATELY WITHOUT A DEFAULT. Publishing replaces a
    # set's base document AND drops the overlay behind it, so the wrong firm
    # here is not a misfiled copy — it is another firm's records overwritten
    # and their queued edits discarded. A default would make that a typo
    # away; making it required makes it a decision.
    ap.add_argument("--firm", required=True, choices=sorted(FIRMS),
                    help="which firm's dashboard to publish to (no default, on purpose)")
    ap.add_argument("--site", default=os.environ.get("MODILLION_SITE", DEFAULT_SITE),
                    help="site root, default %s" % DEFAULT_SITE)
    ap.add_argument("--only", nargs="+", choices=sorted(TARGETS),
                    help="publish only these; default is every set")
    ap.add_argument("--dry-run", action="store_true",
                    help="read and check the files, send nothing")
    args = ap.parse_args()

    site = args.site.rstrip("/")
    firm = args.firm
    key = os.environ.get("MODILLION_TOKEN", "")
    names = args.only or list(TARGETS)

    print("Publishing %s records to %s" % (firm, site))
    if not key:
        print("No MODILLION_TOKEN set — every request will be refused. "
              "a 403 below if they are not.")
    print()

    failures = 0
    for name in names:
        filename, set_name, label = TARGETS[name]
        local = os.path.join(firm_dir(firm), filename)

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
        ok, result = post(site + publish_path(set_name, firm), payload, key)
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
