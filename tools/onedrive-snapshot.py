#!/usr/bin/env python3
"""
Build a local dataset for the Company Dashboard from a folder of OneDrive files.

TEMPORARY SCAFFOLDING. This exists so the dashboard can be developed against the
real folder structure before Microsoft Graph is connected. Once GraphProvider is
live, this script and the JSON it produces can both be deleted.

The output file (dashboard-data.json) contains real deal and sponsor names and is
gitignored. It must never be committed — this repository is public. The script
itself contains no data and is safe to commit.

Usage:
    python3 tools/onedrive-snapshot.py "/path/to/OneDrive folder"
    python3 tools/onedrive-snapshot.py "/path/to/folder" --anonymise -o dashboard-data.demo.json

Only names, sizes and timestamps are read. File contents are never opened.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

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


def walk(root, anon):
    """Return the top-level areas, each holding deals, each holding a file tree."""
    areas = []

    for area_name in sorted(os.listdir(root)):
        area_path = os.path.join(root, area_name)
        if not os.path.isdir(area_path) or area_name.startswith("."):
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


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder", help="Folder to snapshot")
    ap.add_argument("-o", "--out", default="dashboard-data.json",
                    help="Output path (default: dashboard-data.json, gitignored)")
    ap.add_argument("--anonymise", action="store_true",
                    help="Replace deal and sponsor names with stable pseudonyms")
    args = ap.parse_args()

    if not os.path.isdir(args.folder):
        sys.exit(f"Not a folder: {args.folder}")

    anon = Anonymiser(args.anonymise)
    areas = walk(args.folder, anon)
    total = sum(count_files(a["children"]) for a in areas)

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
    print(f"  areas: {len(areas)}  deals: {sum(len(a['children']) for a in areas)}  files: {total}")
    print(f"  anonymised: {args.anonymise}")
    if not args.anonymise:
        print("  WARNING: contains real names — gitignored, do not commit.")


if __name__ == "__main__":
    main()
