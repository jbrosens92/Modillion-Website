#!/usr/bin/env python3
"""
Build a local dataset for the Company Dashboard from a folder of OneDrive files.

TEMPORARY SCAFFOLDING. This exists so the dashboard can be developed against the
real folder structure before Microsoft Graph is connected. Once GraphProvider is
live, this script and the JSON it produces can both be deleted.

The output file (dashboard-data.json) contains real deal and sponsor names and is
gitignored. It must never be committed — this repository is public. The script
itself contains no data and is safe to commit.

The folder it reads is recorded in tools/snapshot-source.txt (gitignored — it is a
local machine path, and it is the answer to "which folder does the dashboard mirror?").
That file holds the path, plus optional "only:" lines naming the top-level folders that
may become dashboard areas. The source folder holds more than the dashboard shows, so
without an only: list the type cards count documents from folders the dashboard never
displays. Keep the list in step with DASHBOARD_CONFIG.areas in dashboard.html.

It also holds an optional "assets-from:" line naming the area whose deals the Asset
Management area is read out of. That area has no folder of its own — see the comment on
ASSET_FOLDER_NAME below for what it is and why it is derived.

Pass a folder to override the path for one run.

Usage:
    python3 tools/onedrive-snapshot.py                       # the recorded source
    python3 tools/onedrive-snapshot.py "/path/to/folder"     # override for this run
    python3 tools/onedrive-snapshot.py "/path/to/folder" --anonymise -o dashboard-data.demo.json

Only names, sizes and timestamps are read. File contents are never opened.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# Where the recorded source folder lives, relative to this script.
SOURCE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshot-source.txt")

# Noise that should never appear in the dashboard.
SKIP_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini", ".localized"}
SKIP_EXTS = {".zip"}

# Recurring per-deal subfolders, grouped into the cross-cutting views the
# dashboard offers. A folder matches a group if its name contains one of the
# patterns (case-insensitive). Deals organise by folder; these read across them.
CROSSCUT = {
    "models": ["model", "underwriting"],
    "term-sheets": ["term sheet", "proposed terms", "loi"],
    "investment-memos": ["investment memo", "memo", "screening"],
    "legal-org": ["legal", "org chart", "agreement", "operating agreement",
                  "final documents", "ground lease", "deposit"],
    "financials": ["financial statement", "quarterly financial", "depreciation",
                   "percentage ownership", "t-12", "rent roll"],
    "investor-updates": ["investor letter", "quarterly update", "project update",
                         "monthly update", "partner materials"],
    "diligence": ["due dilligence", "due diligence", " dd", "data room",
                  "seller documents", "market", "tenant"],
    "sponsor-materials": ["sponsor material", "sponsor agreement", "sponsor"],
}

# The Asset Management area is DERIVED, not read from a folder of its own.
#
# There is no top-level "Asset Management" folder in the source any more: what
# the firm already owns is filed inside the deal folder it closed under. So the
# area is built by reading those subfolders back out of the closed deals named
# on the "assets-from:" line in snapshot-source.txt.
#
# A folder called "Asset Management" is the current convention (The Arden). The
# older deals predate it and file the same material under its parts, which the
# financials and investor-updates crosscut groups already name.
#
# This makes the area a VIEW of files that live elsewhere in the snapshot, not a
# second copy of them. Two things follow, and both are deliberate: totalFiles
# counts the source areas only, and the dashboard's "By document type" cards
# skip this area so a rent roll is not counted once as a deal document and again
# as a property document.
ASSET_FOLDER_NAME = "asset management"
ASSET_GROUPS = {"financials", "investor-updates"}


def iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")


def crosscut_group(folder_name):
    low = folder_name.lower()
    for group, patterns in CROSSCUT.items():
        if any(p in low for p in patterns):
            return group
    return None


class Anonymiser:
    """Stable pseudonyms so an anonymised snapshot stays navigable."""

    def __init__(self, enabled):
        self.enabled = enabled
        self._map = {}

    def deal(self, name):
        if not self.enabled:
            return name
        if name not in self._map:
            self._map[name] = f"Deal {chr(ord('A') + len(self._map) % 26)}" + (
                f"{len(self._map) // 26}" if len(self._map) >= 26 else ""
            )
        return self._map[name]

    def filename(self, name, deal_original, deal_alias):
        if not self.enabled:
            return name
        # Strip the deal name out of the file name, keep the descriptive part.
        cleaned = name
        for token in deal_original.replace("(", " ").replace(")", " ").split():
            if len(token) > 3:
                cleaned = cleaned.replace(token, "").replace(token.lower(), "")
        cleaned = " ".join(cleaned.split()).lstrip("-_ ").strip()
        return f"{deal_alias} — {cleaned or 'Document'}"


def walk(root, anon, only=None):
    """Return the top-level areas, each holding deals, each holding a file tree.

    `only`, if non-empty, limits which top-level folders become areas.
    """
    areas = []

    for area_name in sorted(os.listdir(root)):
        area_path = os.path.join(root, area_name)
        if not os.path.isdir(area_path) or area_name.startswith("."):
            continue
        if only and area_name not in only:
            continue
        # The raw OneDrive download folder and its zip are not part of the tree.
        if area_name.lower().startswith("onedrive_"):
            continue

        deals = []
        for deal_name in sorted(os.listdir(area_path)):
            deal_path = os.path.join(area_path, deal_name)
            if not os.path.isdir(deal_path) or deal_name.startswith("."):
                continue

            alias = anon.deal(deal_name)
            children = build_tree(deal_path, deal_name, alias, anon)
            files = count_files(children)
            if files == 0 and not children:
                continue

            deals.append({
                "name": alias,
                "type": "folder",
                "fileCount": files,
                "children": children,
            })

        if deals:
            areas.append({
                "id": area_name.lstrip("_").lower().replace(" ", "-"),
                "label": area_name.lstrip("_"),
                "children": deals,
            })

    return areas


def build_tree(path, deal_original, deal_alias, anon):
    out = []
    try:
        entries = sorted(os.listdir(path))
    except PermissionError:
        return out

    for name in entries:
        if name in SKIP_NAMES or name.startswith("."):
            continue
        full = os.path.join(path, name)
        try:
            st = os.stat(full)
        except OSError:
            continue

        if os.path.isdir(full):
            kids = build_tree(full, deal_original, deal_alias, anon)
            out.append({
                "name": name,
                "type": "folder",
                "group": crosscut_group(name),
                "modified": iso(st.st_mtime),
                "children": kids,
            })
        else:
            ext = os.path.splitext(name)[1].lower()
            if ext in SKIP_EXTS:
                continue
            out.append({
                "name": anon.filename(name, deal_original, deal_alias),
                "type": "file",
                "ext": ext.lstrip(".") or "file",
                "size": st.st_size,
                "modified": iso(st.st_mtime),
            })
    return out


def count_files(nodes):
    n = 0
    for node in nodes:
        if node["type"] == "file":
            n += 1
        else:
            n += count_files(node.get("children", []))
    return n


def asset_area(source_area):
    """Build the Asset Management area from the deals in `source_area`.

    One property per deal that has asset-management material, carrying that
    material only — not the whole deal folder. Returns None when there is none,
    so an empty tab is never written.
    """
    properties = []

    for deal in source_area["children"]:
        kept = []
        for node in deal["children"]:
            if node["type"] != "folder":
                continue
            if ASSET_FOLDER_NAME in node["name"].lower():
                # The tab IS asset management, so a folder repeating the name is
                # not a step in the trail. Its contents stand in for it, the way
                # the area's own name is not a breadcrumb.
                kept.extend(node["children"])
            elif node.get("group") in ASSET_GROUPS:
                kept.append(node)

        files = count_files(kept)
        if not files:
            continue

        properties.append({
            "name": deal["name"],
            "type": "folder",
            "fileCount": files,
            "children": kept,
        })

    if not properties:
        return None

    return {"id": "asset-management", "label": "Asset Management", "children": properties}


def read_recorded_source():
    """(folder, only, assets_from) as recorded in tools/snapshot-source.txt.

    `only` is the set of top-level folder names allowed to become areas, empty
    meaning take everything. `assets_from` names the one area whose deals the
    Asset Management area is read out of, None meaning do not build it.
    """
    folder, only, assets_from = None, set(), None
    try:
        with open(SOURCE_FILE, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.lower().startswith("only:"):
                    only.add(line.split(":", 1)[1].strip())
                elif line.lower().startswith("assets-from:"):
                    assets_from = line.split(":", 1)[1].strip()
                elif folder is None:
                    folder = os.path.expanduser(line)
    except FileNotFoundError:
        pass

    return folder, only, assets_from


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", nargs="?",
                    help="Folder to snapshot (default: the path in tools/snapshot-source.txt)")
    ap.add_argument("--all-areas", action="store_true",
                    help="Ignore the recorded only: list and take every top-level folder")
    ap.add_argument("--no-assets", action="store_true",
                    help="Skip the derived Asset Management area (see assets-from: in the source file)")
    ap.add_argument("-o", "--out", default="dashboard-data.json",
                    help="Output path (default: dashboard-data.json, gitignored)")
    ap.add_argument("--anonymise", action="store_true",
                    help="Replace deal and sponsor names with stable pseudonyms")
    args = ap.parse_args()

    recorded_folder, only, assets_from = read_recorded_source()
    folder = args.folder or recorded_folder
    if args.all_areas:
        only = set()
    if args.no_assets:
        assets_from = None

    if folder is None:
        sys.exit(
            f"No source folder recorded. Write the folder to mirror into {SOURCE_FILE}, "
            "or pass one on the command line."
        )

    if not os.path.isdir(folder):
        sys.exit(f"Not a folder: {folder}")

    missing = sorted(n for n in only if not os.path.isdir(os.path.join(folder, n)))
    if missing:
        print(f"  NOTE: recorded area not found in source: {', '.join(missing)}")

    anon = Anonymiser(args.anonymise)
    areas = walk(folder, anon, only)

    # Counted before the derived area is appended: its files already live in the
    # area it was read from, and totalFiles answers "how many documents are in
    # this folder", not "how many rows does the dashboard draw".
    total = sum(count_files(a["children"]) for a in areas)
    deal_count = sum(len(a["children"]) for a in areas)

    if assets_from:
        source_area = next((a for a in areas if a["label"] == assets_from.lstrip("_")), None)
        if source_area is None:
            print(f"  NOTE: assets-from area not in the snapshot: {assets_from}")
        else:
            derived = asset_area(source_area)
            if derived is None:
                print(f"  NOTE: no asset-management material under {assets_from}")
            else:
                areas.insert(0, derived)
                print(f"  asset management: {len(derived['children'])} properties, "
                      f"{count_files(derived['children'])} files (a view of {assets_from})")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "local-folder-snapshot",
        "anonymised": args.anonymise,
        "totalFiles": total,
        "areas": areas,
    }

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)

    print(f"Wrote {args.out}")
    print(f"  areas: {len(areas)}  deals: {deal_count}  files: {total}")
    print(f"  anonymised: {args.anonymise}")
    if not args.anonymise:
        print("  WARNING: contains real names — gitignored, do not commit.")


if __name__ == "__main__":
    main()
