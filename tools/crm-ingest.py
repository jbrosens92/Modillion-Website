#!/usr/bin/env python3
"""
Fold forwarded investor email into the Company Dashboard CRM.

The workflow this serves: a team member forwards an investor thread to the CRM
intake address, the messages land in a folder as .eml files, and this script
reads them into crm-data.json — matching each message to an investor record by
the sender's domain, or creating a record when the firm is new.

    python3 tools/crm-ingest.py crm-inbox/                  # fold it in
    python3 tools/crm-ingest.py crm-inbox/ --dry-run        # show, change nothing
    python3 tools/crm-ingest.py crm-inbox/ --archive done/  # move files once read

Both crm-data.json and crm-inbox/ are gitignored: they hold real investor names,
real addresses and real conversation content, and this repository is public. The
script itself holds no data and is safe to commit.

Messages are deduplicated on their Message-ID, so running this twice over the
same folder does not double-log anything.

The parsing here deliberately mirrors the reader built into dashboard.html, so
an entry logged by forwarding an email and one typed into the dashboard come out
the same shape. Neither is a language model: both pull structured fields out of
the text and leave a human to correct them. Read what this writes.
"""

import argparse
import email
import email.policy
import email.utils
import json
import os
import re
import shutil
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRM_FILE = os.path.join(HERE, "crm-data.json")

STAGES = ["Prospect", "Contacted", "In diligence", "Committed", "Passed", "Dormant"]

# Mail hosts that say nothing about who someone works for.
MAIL_HOSTS = {"gmail", "outlook", "hotmail", "yahoo", "icloud", "me", "aol",
              "proton", "protonmail", "live", "msn", "comcast", "verizon"}
HOST_NOISE = {"www", "mail", "email", "smtp", "corp", "group", "inc", "llc",
              "com", "co", "org", "net", "edu", "gov", "uk", "us", "ca", "au"}

# Asset halves too generic to identify a deal on their own — "Fund II" and
# "Portfolio" repeat across sponsors.
GENERIC_ASSET = re.compile(r"^(gp\s+)?(fund|portfolio|programmatic|co-?invest|equity|deal)\b")


# ---------------------------------------------------------------- helpers

def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "investor"


def firm_from_domain(addr):
    """dana@northquay.com -> Northquay;  kai@brookline-family.co.uk -> Brookline Family."""
    match = re.search(r"@([\w.-]+)$", addr or "")
    if not match:
        return ""
    labels = match.group(1).lower().split(".")
    if any(label in MAIL_HOSTS for label in labels):
        return ""
    words = [label for label in labels if label not in HOST_NOISE]
    if not words:
        return ""
    return " ".join(part.capitalize() for part in re.split(r"[-_]", words[-1]) if part)


def body_text(message):
    """Plain text of a message, preferring text/plain over stripped HTML."""
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_type() == "text/plain":
                try:
                    return part.get_content()
                except Exception:
                    continue
        for part in message.walk():
            if part.get_content_type() == "text/html":
                try:
                    return re.sub(r"<[^>]+>", " ", part.get_content())
                except Exception:
                    continue
        return ""
    try:
        content = message.get_content()
    except Exception:
        return ""
    if message.get_content_type() == "text/html":
        content = re.sub(r"<[^>]+>", " ", content)
    return content


def clean_body(text):
    """Drop quoted history, forwarding banners and signature blocks."""
    lines = []
    for line in text.splitlines():
        if re.match(r"^\s*>", line):
            continue
        if re.match(r"^\s*-+\s*(Forwarded message|Original Message)\s*-+", line, re.I):
            continue
        if re.match(r"^\s*(From|To|Cc|Bcc|Sent|Date|Subject|Reply-To)\s*:", line, re.I):
            continue
        if re.match(r"^\s*--\s*$", line):
            break
        lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


# ---------------------------------------------------------------- readers

def read_money(number, unit):
    try:
        value = float(number.replace(",", ""))
    except ValueError:
        return None
    unit = (unit or "").lower()
    if unit in ("k", "thousand"):
        value *= 1e3
    elif unit in ("m", "mm", "million"):
        value *= 1e6
    elif unit in ("b", "bn", "billion"):
        value *= 1e9
    return value


def format_money(value):
    if value is None:
        return ""
    if value >= 1e9:
        return "$%s bn" % (round(value / 1e9, 1) if value % 1e9 else int(value / 1e9))
    if value >= 1e6:
        return "$%sm" % (round(value / 1e6, 1) if value % 1e6 else int(value / 1e6))
    if value >= 1e3:
        return "$%dk" % round(value / 1e3)
    return "$%d" % value


def find_check(text):
    span = re.search(
        r"\$\s?([\d,.]+)\s?(k|m|mm|bn|b|million|billion|thousand)?\s*(?:-|–|—|to)\s*"
        r"\$?\s?([\d,.]+)\s?(k|m|mm|bn|b|million|billion|thousand)?", text, re.I)
    if span:
        unit_high = span.group(4) or span.group(2)
        low = read_money(span.group(1), span.group(2) or unit_high)
        high = read_money(span.group(3), unit_high)
        if low is not None and high is not None:
            return low, high, "%s–%s" % (format_money(low), format_money(high))

    one = re.search(r"\$\s?([\d,.]+)\s?(k|m|mm|bn|b|million|billion|thousand)?\b", text, re.I)
    if one:
        value = read_money(one.group(1), one.group(2))
        if value is not None and value >= 1000:
            return value, value, format_money(value)
    return None


def find_stage(text):
    low = text.lower()
    # "our typical commitment is $3-8m" is a size, not a decision.
    if re.search(r"\b(has committed|have committed|are committing|is committing|"
                 r"committing \$|will commit|wired|signed the (lpa|sub docs?|subscription)|"
                 r"countersigned|closing on)\b", low):
        return "Committed"
    if re.search(r"\b(passed|passing|declined|not a fit|no interest|took a pass|won'?t be moving)\b", low):
        return "Passed"
    if re.search(r"\b(diligence|ddq|data room|due dilligence|onboarding|legal review|"
                 r"ic memo|investment committee)\b", low):
        return "In diligence"
    if re.search(r"\b(intro|introduction|first call|reached out|initial|reconnect(ed)?|spoke)\b", low):
        return "Contacted"
    return None


def find_next(text):
    cue = re.compile(
        r"\b(next step|follow up|following up|circle back|revert|will send|i'?ll send|"
        r"sending|send (?:over|them|him|her|the)|share the|schedule|set up a|book a|"
        r"by (?:monday|tuesday|wednesday|thursday|friday|next week|end of week|eow))\b", re.I)
    sentences = [s.strip() for s in re.findall(r"[^.!?]+[.!?]*", text.replace("\n", " ")) if s.strip()]
    for sentence in reversed(sentences):
        if cue.search(sentence):
            return sentence
    return ""


def find_deals(text, deal_names):
    """Same rule as the dashboard: a sponsor alone is only enough when that
    sponsor has exactly one deal, and generic asset halves never match alone."""
    low = text.lower()

    sponsor_count = {}
    for name in deal_names:
        sponsor = name.lower().split(" - ")[0].strip()
        sponsor_count[sponsor] = sponsor_count.get(sponsor, 0) + 1

    hits = []
    for name in deal_names:
        folder = name.lower()
        if folder in low:
            hits.append(name)
            continue

        sponsor = folder.split(" - ")[0].strip()
        asset = (folder.split(" - ")[1] if " - " in folder else "").split("(")[0].strip()

        has_sponsor = len(sponsor) >= 3 and re.search(r"\b%s\b" % re.escape(sponsor), low)
        has_asset = len(asset) >= 5 and re.search(r"\b%s\b" % re.escape(asset), low)
        asset_generic = not asset or GENERIC_ASSET.match(asset)

        if has_sponsor and has_asset:
            hits.append(name)
        elif has_asset and not asset_generic:
            hits.append(name)
        elif has_sponsor and sponsor_count[sponsor] == 1:
            hits.append(name)

    seen, unique = set(), []
    for name in hits:
        if name not in seen:
            seen.add(name)
            unique.append(name)
    return unique


def deal_names_from_snapshot():
    """Deal folder names from the document snapshot, when one is present."""
    snapshot = load_json(os.path.join(HERE, "dashboard-data.json"))
    if not snapshot:
        return []
    names = []
    for area in snapshot.get("areas", []):
        for child in area.get("children", []):
            if child.get("type") == "folder":
                names.append(child["name"])
    return names


# ---------------------------------------------------------------- matching

def match_investor(investors, from_addr, text):
    """Existing record by address, then by firm name in the text. Returns
    (record_or_None, proposed_name)."""
    domain = from_addr.split("@")[-1].lower() if "@" in from_addr else ""

    for record in investors:
        for contact in record.get("contacts", []):
            email_addr = (contact.get("email") or "").lower()
            if email_addr and (email_addr == from_addr.lower() or email_addr.split("@")[-1] == domain):
                return record, record["name"]

    low = text.lower()
    best = None
    for record in investors:
        full = record["name"].lower()
        if full in low:
            if best is None or len(full) > best[1]:
                best = (record, len(full))
            continue
        lead = re.sub(r"[^a-z0-9]", "", full.split(" ")[0])
        if len(lead) >= 4 and re.search(r"\b%s\b" % lead, low):
            if best is None or len(lead) > best[1]:
                best = (record, len(lead))
    if best:
        return best[0], best[0]["name"]

    # The firm name read off the domain may already be on file under a record
    # that simply has no contact saved yet — check before creating a duplicate.
    guess = firm_from_domain(from_addr)
    if guess:
        for record in investors:
            if slugify(record["name"]) == slugify(guess):
                return record, record["name"]

    return None, guess


def new_investor(name, stage, deals, contact_name, contact_email, existing_ids):
    base = slugify(name)
    ident, suffix = base, 2
    while ident in existing_ids:
        ident = "%s-%d" % (base, suffix)
        suffix += 1

    contacts = []
    if contact_email:
        contacts.append({"name": contact_name or "", "title": "", "email": contact_email})

    return {
        "id": ident,
        "name": name,
        "type": "Unclassified",
        "stage": stage,
        "owner": "",
        "location": "",
        "website": "",
        "aum": "",
        "checkSize": {"min": None, "max": None, "note": ""},
        "mandate": "",
        "priority": "",
        "tags": ["Created from forwarded email"],
        "deals": list(deals),
        "contacts": contacts,
        "research": [],
        "why": "",
        "conversations": [],
    }


# ---------------------------------------------------------------- ingest

def read_message(path, investors, deal_names, existing_ids):
    with open(path, "rb") as fh:
        message = email.message_from_binary_file(fh, policy=email.policy.default)

    from_name, from_addr = email.utils.parseaddr(str(message.get("From", "")))
    subject = str(message.get("Subject", "")).strip()
    message_id = str(message.get("Message-ID", "")).strip() or ("file:" + os.path.basename(path))

    date_header = message.get("Date")
    try:
        when = email.utils.parsedate_to_datetime(str(date_header)).date().isoformat()
    except Exception:
        when = datetime.now().date().isoformat()

    text = clean_body(body_text(message))
    haystack = subject + "\n" + text

    record, proposed = match_investor(investors, from_addr, haystack)
    stage = find_stage(haystack)
    check = find_check(haystack)
    deals = find_deals(haystack, deal_names)

    created = False
    if record is None:
        if not proposed:
            return None, "no investor could be identified (sender: %s)" % (from_addr or "unknown")
        record = new_investor(proposed, stage or "Contacted", deals,
                              from_name, from_addr, existing_ids)
        existing_ids.add(record["id"])
        investors.append(record)
        created = True

    if any(c.get("id") == message_id for c in record["conversations"]):
        return None, "already logged"

    record["conversations"].append({
        "id": message_id,
        "date": when,
        "channel": "Email",
        "who": from_name or from_addr,
        "subject": re.sub(r"^\s*(fwd?|re)\s*:\s*", "", subject, flags=re.I).strip(),
        "summary": text,
        "check": check[2] if check else "",
        "deals": deals,
        "next": find_next(text),
        "loggedVia": "forwarded email",
        "loggedAt": datetime.now().isoformat(timespec="seconds"),
    })

    # Roll the record forward the same way the dashboard does.
    if stage:
        record["stage"] = stage
    elif record.get("stage") == "Prospect":
        record["stage"] = "Contacted"

    for deal in deals:
        if deal not in record["deals"]:
            record["deals"].append(deal)

    size = record.setdefault("checkSize", {"min": None, "max": None, "note": ""})
    if check and size.get("min") is None and size.get("max") is None:
        size["min"], size["max"] = check[0], check[1]
        size["note"] = "From a forwarded email dated %s" % when

    # Keep the sender on file so the next thread matches on the address.
    if from_addr and not any((c.get("email") or "").lower() == from_addr.lower()
                             for c in record.get("contacts", [])):
        record.setdefault("contacts", []).append(
            {"name": from_name or "", "title": "", "email": from_addr})

    label = "created %s" % record["name"] if created else record["name"]
    return record, label


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inbox", help="Folder of .eml files forwarded to the CRM address")
    parser.add_argument("-f", "--file", default=CRM_FILE, help="CRM file to update")
    parser.add_argument("--dry-run", action="store_true", help="Report only, write nothing")
    parser.add_argument("--archive", metavar="DIR", help="Move each message here once read")
    args = parser.parse_args()

    if not os.path.isdir(args.inbox):
        sys.exit("Not a folder: %s" % args.inbox)

    crm = load_json(args.file)
    if crm is None:
        sys.exit("No CRM file at %s — create it, or pass --file." % args.file)

    investors = crm.setdefault("investors", [])
    existing_ids = {record["id"] for record in investors}
    deal_names = deal_names_from_snapshot()

    messages = sorted(f for f in os.listdir(args.inbox) if f.lower().endswith(".eml"))
    if not messages:
        print("No .eml files in %s" % args.inbox)
        return

    logged = skipped = 0
    for filename in messages:
        path = os.path.join(args.inbox, filename)
        try:
            record, note = read_message(path, investors, deal_names, existing_ids)
        except Exception as exc:                      # one bad message must not stop the run
            print("  !! %-42s %s" % (filename, exc))
            skipped += 1
            continue

        if record is None:
            print("  -- %-42s %s" % (filename, note))
            skipped += 1
            continue

        logged += 1
        print("  ok %-42s -> %s" % (filename, note))

        if args.archive and not args.dry_run:
            os.makedirs(args.archive, exist_ok=True)
            shutil.move(path, os.path.join(args.archive, filename))

    if args.dry_run:
        print("\nDry run — %d would be logged, %d skipped. Nothing written." % (logged, skipped))
        return

    crm["generatedAt"] = datetime.now().date().isoformat()
    crm.setdefault("stages", STAGES)
    with open(args.file, "w", encoding="utf-8") as fh:
        json.dump(crm, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print("\n%d logged, %d skipped. Wrote %s" % (logged, skipped, args.file))
    print("Reload the dashboard to see them. Check what was read before trusting it.")


if __name__ == "__main__":
    main()
