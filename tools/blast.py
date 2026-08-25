#!/usr/bin/env python3
"""
Drive the news blast from a terminal.

The blast runs itself on Vercel Cron (see vercel.json): three sweeps
on Monday morning, one send at 11:00 UTC. This is for the times you
do not want to wait for a Monday — checking what it has found,
sweeping on demand after adding a watch entry, and sending the first
one by hand so a person sees it before four people do.

    python3 tools/blast.py status          what is configured, what is queued
    python3 tools/blast.py preview         the digest as it stands, unsent
    python3 tools/blast.py sweep           run the stalest entries now
    python3 tools/blast.py sweep --limit 8 run all of them
    python3 tools/blast.py send --dry-run  compose it, send nothing
    python3 tools/blast.py send            send it, and mark it sent

SEND MAILS FOUR PEOPLE AND CANNOT BE UNSENT, so it asks first unless
you pass --yes. Everything sent is marked sent and will not go again.

    python3 tools/blast.py --site https://www.modillionpartners.com ...

ENVIRONMENT
    MODILLION_SITE         default https://www.modillionpartners.com
    DASHBOARD_WRITE_KEY    required for sweep and send

The endpoint refuses to sweep or send unless the deployment sets
CRON_SECRET or DASHBOARD_WRITE_KEY — see the header of api/blast.js
for why this one is not allowed to run open.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_SITE = "https://www.modillionpartners.com"


def call(url, key, method="GET"):
    req = urllib.request.Request(url, method=method)
    if key:
        req.add_header("x-dashboard-key", key)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
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


def show_status(d):
    print("  store configured   %s" % ("yes" if d.get("store") else "no"))
    print("  watchlist seeded   %s" % ("yes" if d.get("seeded") else "no — run publish.py --only mentions"))
    print("  research key       %s" % ("yes" if d.get("research") else "no — sweeps will refuse"))
    print("  mail configured    %s" % ("yes" if d.get("mail") else "no — sends will refuse"))
    print("  locked             %s" % ("yes" if d.get("locked") else "NO — sweep and send are disabled"))
    c = d.get("counts")
    if c:
        print("  watching           %d entries" % c.get("watching", 0))
        print("  filed / unsent     %d / %d" % (c.get("filed", 0), c.get("unsent", 0)))
        print("  last send          %s" % (c.get("lastSend") or "never"))
        print("  recipients         %d" % c.get("recipients", 0))


def show_preview(d):
    print("Period: %s" % (d.get("period") or "—"))
    print("Unsent: %d" % d.get("count", 0))
    print("To:     %s" % ", ".join(d.get("recipients") or []) or "—")
    for g in d.get("groups") or []:
        print("")
        print("%s%s" % (g.get("label", "?"), " — beat" if g.get("kind") == "topic" else ""))
        for it in g.get("items") or []:
            meta = " · ".join(x for x in (it.get("publication"), it.get("date")) if x)
            print("    %s" % it.get("title", ""))
            if meta:
                print("      %s" % meta)
            if it.get("quote"):
                print('      "%s"' % it["quote"])
            if it.get("takeaway"):
                print("      %s" % it["takeaway"])
            print("      %s" % it.get("url", ""))
    for n in d.get("notes") or []:
        print("")
        print("Note: %s" % n)


def show_sweep(d):
    print("Swept %d entries in %ds, filed %d new."
          % (d.get("swept", 0), int(d.get("elapsedMs", 0) / 1000), d.get("filed", 0)))
    for e in d.get("entries") or []:
        if e.get("skipped"):
            print("  %-32s skipped — %s" % (e.get("label", "?"), e["skipped"]))
            continue
        if e.get("error"):
            print("  %-32s FAILED — %s" % (e.get("label", "?"), e["error"]))
            continue
        print("  %-32s %d found, %d new, %d dropped"
              % (e.get("label", "?"), e.get("found", 0), e.get("new", 0), e.get("dropped", 0)))
        for n in e.get("notes") or []:
            print("      %s" % n)


def main():
    ap = argparse.ArgumentParser(description="Drive the Modillion news blast.")
    ap.add_argument("op", choices=["status", "preview", "sweep", "send"])
    ap.add_argument("--site", default=os.environ.get("MODILLION_SITE", DEFAULT_SITE))
    ap.add_argument("--limit", type=int, default=None,
                    help="sweep: how many entries this run (default 4)")
    ap.add_argument("--dry-run", action="store_true",
                    help="send: compose it and report, send nothing")
    ap.add_argument("--yes", action="store_true", help="send: do not ask first")
    args = ap.parse_args()

    site = args.site.rstrip("/")
    key = os.environ.get("DASHBOARD_WRITE_KEY", "")

    if args.op in ("sweep", "send") and not key:
        print("No DASHBOARD_WRITE_KEY set — sweep and send will be refused.", file=sys.stderr)
        return 2

    if args.op == "status":
        ok, d = call(site + "/api/blast", key)
        if not ok:
            print("Failed: %s" % d, file=sys.stderr)
            return 1
        print("Blast at %s" % site)
        show_status(d)
        return 0

    if args.op == "preview":
        ok, d = call(site + "/api/blast?op=preview", key)
        if not ok:
            print("Failed: %s" % d, file=sys.stderr)
            return 1
        show_preview(d)
        return 0

    if args.op == "sweep":
        url = site + "/api/blast?op=sweep"
        if args.limit:
            url += "&limit=%d" % args.limit
        print("Sweeping — this reads the web and can take a few minutes.")
        ok, d = call(url, key, method="POST")
        if not ok:
            print("Failed: %s" % d, file=sys.stderr)
            return 1
        show_sweep(d)
        return 0

    # send
    ok, d = call(site + "/api/blast?op=preview", key)
    if not ok:
        print("Failed: %s" % d, file=sys.stderr)
        return 1
    if not d.get("count"):
        print("Nothing filed and unsent. An empty week sends nothing.")
        return 0

    show_preview(d)
    print("")
    if args.dry_run:
        print("Dry run — nothing sent.")
        return 0
    if not args.yes:
        who = ", ".join(d.get("recipients") or [])
        answer = input("Send these %d items to %s? [y/N] " % (d["count"], who))
        if answer.strip().lower() not in ("y", "yes"):
            print("Not sent.")
            return 0

    ok, out = call(site + "/api/blast?op=send", key, method="POST")
    if not ok:
        print("Failed: %s" % out, file=sys.stderr)
        return 1
    if not out.get("sent"):
        print("Not sent: %s" % (out.get("why") or "unknown"))
        return 1
    print("Sent %d items to %s."
          % (out.get("count", 0), ", ".join(x["to"] for x in out.get("delivered") or [])))
    for f in out.get("failed") or []:
        print("  failed: %s — %s" % (f.get("to"), f.get("error")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
