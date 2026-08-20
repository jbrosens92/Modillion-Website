#!/usr/bin/env python3
"""
Turn the document index into deal records — the one-time migration off folders.

WHY THIS EXISTS, AND WHY IT RUNS FIRST
The dashboard used to mirror a OneDrive folder: 997 files across 25 deal
folders, browsable on a Deal Pipeline tab and an Asset Management tab. That
whole apparatus is being deleted, because a tool that needs a synced folder, a
published index and a snapshot script is a tool one person maintains.

But the folder tree is the ONLY place three things exist:
  - the 22 deal names, and which area each sits in
  - which operator runs each one, recoverable from the folder naming convention
  - the debt roll-up: lender, balance, rate and maturity for the closed deals

Delete dashboard-data.json first and those are gone. So this runs first, and it
reads only files that are about to be deleted.

WHAT IT WRITES
deals-data.json, in the same shape as operator-data.json, ready to be published
to the shared store by tools/publish.py. Gitignored, like every other data file
— it carries real deal and sponsor names.

USAGE
    python3 tools/extract-deals.py
    python3 tools/extract-deals.py --dry-run     # print the summary, write nothing
"""

import argparse
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The derived Asset Management area is a VIEW of the closed deals, not a third
# set of deals. Reading it would duplicate all three of them.
SKIP_AREAS = {"asset-management"}

AREA_IDS = {"Active Deals": "active-deals", "Closed Deals": "closed-deals"}

DEAL_STATES = ["Live", "On hold", "Dead", "Closed"]

# The 14 workbook columns, in order, mapped onto named fields. The values in
# the index are ALREADY formatted strings — fmt_debt_cell() ran when the
# snapshot was written — so this is a rename, not a re-format.
DEBT_FIELDS = [
    "property", "market", "assetClass", "acquisitionDate", "lender",
    "loanCommitted", "loanBalance", "rateType", "index", "indexSpread",
    "rateCap", "rateFloor", "maturity", "extensionOptions",
]


def norm_name(name):
    """A name reduced to what is worth comparing. Lowercase, punctuation to
    spaces, "the" dropped from the front. Ported from onedrive-snapshot.py: the
    folder and the workbook are typed by different people and agree on the
    words, not the formatting."""
    n = re.sub(r"[^a-z0-9]+", " ", str(name).lower()).strip()
    return n[4:].strip() if n.startswith("the ") else n


def name_head(name):
    """The part of a folder name before the location: "X - Raleigh, NC" -> "X"."""
    for sep in (" - ", " — ", " ("):
        if sep in name:
            return name.split(sep, 1)[0]
    return name


def match_property(debt_name, property_names):
    """The deal a debt row belongs to, or None. Tried strongest first, because a
    wrong join is worse than no join: a loan shown against the wrong building is
    a number somebody acts on. Ported verbatim in spirit from
    onedrive-snapshot.py, ordering intact."""
    want = norm_name(debt_name)
    if not want:
        return None
    candidates = [(p, norm_name(p), norm_name(name_head(p))) for p in property_names]

    for prop, full, head in candidates:                 # 1. whole name, or name
        if want in (full, head):                        #    with location trimmed
            return prop
    for prop, full, head in candidates:                 # 2. one opening the other
        if full.startswith(want + " ") or want.startswith(full + " "):
            return prop
        if head.startswith(want + " ") or want.startswith(head + " "):
            return prop
    words = set(want.split())                           # 3. every word inside the
    hits = [prop for prop, full, _ in candidates        #    other, and only if it
            if words and words <= set(full.split())]    #    picks out exactly one
    return hits[0] if len(hits) == 1 else None


def match_operator(deal_name, operator_names):
    """The operator running a deal, or "". Folders are named
    "Sponsor - Asset (City, ST)", so the head is the sponsor — but only when it
    actually matches a known operator. "Workforce Housing Portfolio" has no
    sponsor in its name and must not get one invented."""
    head = norm_name(name_head(deal_name))
    if not head:
        return ""
    for op in operator_names:
        if norm_name(op) == head:
            return op
    return ""


LOCATION = re.compile(r"\(([^)]+,\s*[A-Z]{2})\)\s*$|(?:^|\s-\s)([^-]+,\s*[A-Z]{2})\s*$")


def market_from_name(deal_name):
    """"X (Durham, NC)" or "X - Westchester, NY" -> the location. Blank when the
    name does not carry one, which is most of the funds and programmatics."""
    m = LOCATION.search(deal_name)
    if not m:
        return ""
    return (m.group(1) or m.group(2) or "").strip()


def slug(name, taken):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "deal"
    out, n = s, 2
    while out in taken:
        out, n = "%s-%d" % (s, n), n + 1
    taken.add(out)
    return out


def main():
    ap = argparse.ArgumentParser(description="Extract deal records from the document index.")
    ap.add_argument("--dry-run", action="store_true", help="print the summary, write nothing")
    args = ap.parse_args()

    index_path = os.path.join(HERE, "dashboard-data.json")
    if not os.path.exists(index_path):
        sys.exit("dashboard-data.json not found — it is the only source for this, and it "
                 "may already have been deleted. Restore it before running this.")
    with open(index_path, encoding="utf-8") as fh:
        index = json.load(fh)

    operators = []
    op_path = os.path.join(HERE, "operator-data.json")
    if os.path.exists(op_path):
        with open(op_path, encoding="utf-8") as fh:
            operators = [o.get("name", "") for o in json.load(fh).get("operators", [])]

    # --- the deals, one per folder in the two real areas ---
    deals, taken = [], set()
    today = datetime.date.today().isoformat()
    for area in index.get("areas", []):
        label = area.get("label", "")
        area_id = AREA_IDS.get(label)
        if not area_id or area_id in SKIP_AREAS:
            continue
        for node in area.get("children", []):
            if node.get("type") != "folder":
                continue
            name = node["name"]
            deals.append({
                "id": slug(name, taken),
                "name": name,
                "area": area_id,
                "operator": match_operator(name, operators),
                "status": "Closed" if area_id == "closed-deals" else "Live",
                "market": market_from_name(name),
                "assetClass": "",
                "note": "",
                "addedAt": today,
                "lastActivity": "",
                "debt": None,
            })

    # --- join the debt roll-up on ---
    debt = index.get("debt") or {}
    rows = debt.get("rows") or []
    by_name = {d["name"]: d for d in deals}
    joined, unjoined = 0, []
    for row in rows:
        record = dict(zip(DEBT_FIELDS, [str(c).strip() for c in row]))
        target = match_property(record.get("property", ""), list(by_name))
        if not target:
            unjoined.append(record.get("property", "?"))
            continue
        deal = by_name[target]
        # The workbook is the better answer for these two where it has one.
        deal["market"] = record.get("market") or deal["market"]
        deal["assetClass"] = record.get("assetClass") or deal["assetClass"]
        deal["debt"] = {k: v for k, v in record.items()
                        if k not in ("property", "market", "assetClass") and v}
        deal["debt"]["source"] = debt.get("file", "")
        joined += 1

    out = {
        "generatedAt": today,
        "source": "extracted",
        "note": ("Extracted from dashboard-data.json by tools/extract-deals.py when the "
                 "document mirror was retired. Gitignored — never commit."),
        "areas": [{"id": "active-deals", "label": "Active Deals"},
                  {"id": "closed-deals", "label": "Closed Deals"}],
        "stages": DEAL_STATES,
        "deals": deals,
    }

    active = sum(1 for d in deals if d["area"] == "active-deals")
    closed = len(deals) - active
    with_op = sum(1 for d in deals if d["operator"])
    print("Deals extracted: %d  (%d active, %d closed)" % (len(deals), active, closed))
    print("Operator matched: %d of %d" % (with_op, len(deals)))
    print("Debt rows joined: %d of %d" % (joined, len(rows)))
    if unjoined:
        print("  NOT joined (no confident match — left off rather than guessed): %s"
              % ", ".join(unjoined))
    print()
    for d in deals:
        print("  %-11s %-42s %-16s %s" % (
            d["area"].replace("-deals", ""), d["name"][:42],
            d["operator"] or "-", "debt" if d["debt"] else ""))

    if args.dry_run:
        print("\nDry run — deals-data.json not written.")
        return

    dest = os.path.join(HERE, "deals-data.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
    print("\nWrote %s (%.1f KB)" % (dest, os.path.getsize(dest) / 1024.0))


if __name__ == "__main__":
    main()
