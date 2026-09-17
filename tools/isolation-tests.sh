#!/bin/bash
# ============================================================
# tools/isolation-tests.sh -- does the firm boundary actually hold?
#
# Thirteen checks against a running deployment. They are the answer to
# "the code looks right, but does the deployed thing refuse what it is
# supposed to refuse?" -- which is not a question unit tests can answer,
# because the interesting failures live in how requireUser, the query
# string and the store fit together at request time.
#
# WORTH KNOWING WHY THIS EXISTS AT ALL: when it was first run it passed
# 13/13 while the 409 firm-mismatch guard was dead code -- it read the
# firm from the wrong level of the payload and waved everything through.
# The suite did not catch it; a hand-written probe afterwards did, and
# those cases are now checks 14-17 below. Green here is necessary, not
# sufficient. Add a check whenever you add a refusal.
#
# SAFE AGAINST A LIVE DEPLOYMENT. Every check asserts a REFUSAL or does
# a READ. The four POSTs at the end are all expected to be rejected
# except two deliberate no-op appends ({"patches":{}}), which merge to
# nothing and are trimmed by the next publish.
#
# USAGE
#   export SITE=https://www.modillionpartners.com
#   export TOK=<a Modillion session access_token>
#   bash tools/isolation-tests.sh
#
# Optionally, against a protected Vercel preview:
#   export BYPASS=<protection-bypass secret>
#
# GETTING TOK -- in Chrome, signed in to the dashboard, console:
#   copy(JSON.parse(localStorage['modillion-session']).access_token)
# It expires in about an hour. A run that suddenly 401s where it should
# 200 is a stale token, not a regression.
# ============================================================

if [ -z "$SITE" ] || [ -z "$TOK" ]; then
  echo "Set SITE and TOK first -- see the header of this file." >&2
  exit 2
fi

fail=0
BYPASS_ARGS=()
if [ -n "$BYPASS" ]; then
  BYPASS_ARGS=(-H "x-vercel-protection-bypass: $BYPASS" -H "x-vercel-set-bypass-cookie: false")
fi

# A guard worth having: if Vercel's own protection is answering, every check
# below returns 401 and the run looks like a boundary failure when it is not.
gate=$(curl -s -m 25 -o /dev/null -w "%{http_code}" "${BYPASS_ARGS[@]}" "$SITE/api/records?probe=1")
if [ "$gate" != "200" ]; then
  echo "STOP: $SITE/api/records?probe=1 returned $gate, expected 200."
  echo "      probe is unauthenticated and firm-blind, so anything but 200 means"
  echo "      the request is not reaching the app -- almost certainly Vercel"
  echo "      Deployment Protection. Set BYPASS, or turn protection off for Preview."
  exit 1
fi
check() { # label expected url
  local got
  got=$(curl -s -m 25 -o /dev/null -w "%{http_code}" "${BYPASS_ARGS[@]}" -H "Authorization: Bearer $TOK" "$SITE$3")
  if [ "$got" = "$2" ]; then printf "  ok    %-52s %s\n" "$1" "$got"
  else printf "  FAIL  %-52s got %s, want %s\n" "$1" "$got" "$2"; fail=$((fail+1)); fi
}
anon() {
  local got
  got=$(curl -s -m 25 -o /dev/null -w "%{http_code}" "${BYPASS_ARGS[@]}" "$SITE$2")
  if [ "$got" = "$1" ]; then printf "  ok    %-52s %s\n" "probe, no token" "$got"
  else printf "  FAIL  %-52s got %s, want %s\n" "probe, no token" "$got" "$1"; fail=$((fail+1)); fi
}

echo "Testing $SITE"
echo
echo "The firm boundary — a MODILLION token asking for Fairwind:"
check "records ?firm=fairwind"            403 "/api/records?set=crm&firm=fairwind"
check "records ?firm=fairwind (lps)"      403 "/api/records?set=lps&firm=fairwind"
check "stamps  ?firm=fairwind"            403 "/api/records?op=stamps&firm=fairwind"
check "agent   ?firm=fairwind"            403 "/api/agent?firm=fairwind"
check "research ?firm=fairwind"           403 "/api/research?firm=fairwind"
echo
echo "A typo must NOT silently become the default firm:"
check "records ?firm=fiarwind"            400 "/api/records?set=crm&firm=fiarwind"
check "stamps  ?firm=fiarwind"            400 "/api/records?op=stamps&firm=fiarwind"
echo
echo "Modillion's own access is unchanged:"
check "records ?firm=modillion"           200 "/api/records?set=crm&firm=modillion"
check "records, no firm (old bookmark)"   200 "/api/records?set=crm"
check "stamps  ?firm=modillion"           200 "/api/records?op=stamps&firm=modillion"
check "stamps, no firm"                   200 "/api/records?op=stamps"
echo
echo "Unauthenticated:"
anon 200 "/api/records?probe=1"
got=$(curl -s -m 25 -o /dev/null -w "%{http_code}" "${BYPASS_ARGS[@]}" "$SITE/api/records?set=crm"); \
  [ "$got" = "401" ] && printf "  ok    %-52s %s\n" "records, no token" "$got" || { printf "  FAIL  %-52s got %s, want 401\n" "records, no token" "$got"; fail=$((fail+1)); }
echo
echo "The firm stamped INSIDE an edit must match the authorised firm:"
post() { # label expected body query
  local got
  got=$(curl -s -m 25 -o /dev/null -w "%{http_code}" -X POST "${BYPASS_ARGS[@]}" \
        -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
        -d "$3" "$SITE$4")
  if [ "$got" = "$2" ]; then printf "  ok    %-52s %s\n" "$1" "$got"
  else printf "  FAIL  %-52s got %s, want %s\n" "$1" "$got" "$2"; fail=$((fail+1)); fi
}
post "edit stamped for another firm"        409 '{"overlay":{"patches":{}},"firm":"fairwind"}' "/api/records?set=crm&firm=modillion"
post "PUBLISH stamped for another firm"     409 '{"doc":{"investors":[]},"firm":"fairwind","seen":0}' "/api/records?set=crm&firm=modillion&op=publish"
post "correctly stamped edit (no-op)"       200 '{"overlay":{"patches":{}},"firm":"modillion"}' "/api/records?set=crm&firm=modillion"
post "unstamped edit from an older page"    200 '{"overlay":{"patches":{}}}' "/api/records?set=crm&firm=modillion"
echo
if [ $fail -eq 0 ]; then echo "All checks passed."; else echo "$fail CHECK(S) FAILED."; fi
exit $fail
