#!/bin/bash
# ============================================================
# tools/isolation-tests.sh -- does the firm boundary actually hold?
#
# Checks a RUNNING deployment: not "is the code right" but "does the
# deployed thing refuse what it should?" The interesting failures live
# in how requireUser, the query string and the store meet at request
# time, and no unit test reaches them.
#
# IT DISCOVERS WHICH FIRMS THE TOKEN CAN REACH, and this matters more
# than it sounds. Two earlier versions hardcoded "the token belongs to
# Modillion" and both misreported: once when an address was granted
# both firms, once when handed a Fairwind token -- which reported eight
# FAILURES while the boundary was working perfectly, because every
# Modillion endpoint correctly answered 403.
#
# A suite that cries wolf is one people stop reading. This repo already
# paid for that lesson: the 409 guard was dead code through a fully
# green run. So this version asks the deployment what the token can
# reach, then asserts the right thing either way.
#
# SAFE AGAINST PRODUCTION. Everything is a refusal or a read, except
# two no-op appends ({"patches":{}}) against a firm the token already
# holds -- they merge to nothing and the next publish trims them.
#
# USAGE
#   export SITE=https://www.modillionpartners.com
#   export TOK=<any dashboard session access_token>
#   bash tools/isolation-tests.sh
#
#   export BYPASS=<secret>     # only for a protected Vercel preview
#
# GETTING TOK -- in Chrome, signed in, console:
#   copy(JSON.parse(localStorage['modillion-session']).access_token)
# ...or 'fairwind-session' on that firm's dashboard. Storage is
# namespaced per firm, which is itself part of what this tests.
# Tokens last about an hour; a run that 401s everywhere is a stale one.
# ============================================================

if [ -z "$SITE" ] || [ -z "$TOK" ]; then
  echo "Set SITE and TOK first -- see the header of this file." >&2
  exit 2
fi

# Keep in step with api/_firms.js.
FIRMS="modillion fairwind"

fail=0
BYPASS_ARGS=()
[ -n "$BYPASS" ] && BYPASS_ARGS=(-H "x-vercel-protection-bypass: $BYPASS" -H "x-vercel-set-bypass-cookie: false")

get()  { curl -s -m 25 -o /dev/null -w "%{http_code}" "${BYPASS_ARGS[@]}" -H "Authorization: Bearer $TOK" "$SITE$1"; }
anon() { curl -s -m 25 -o /dev/null -w "%{http_code}" "${BYPASS_ARGS[@]}" "$SITE$1"; }
post() { curl -s -m 25 -o /dev/null -w "%{http_code}" -X POST "${BYPASS_ARGS[@]}" \
           -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d "$2" "$SITE$1"; }
ok()   { printf "  ok    %-50s %s\n" "$1" "$2"; }
bad()  { printf "  FAIL  %-50s got %s, want %s\n" "$1" "$2" "$3"; fail=$((fail+1)); }

# ALWAYS CALLED AS: got=$(...); want "label" "$got" 200
#
# Never with the call inlined as "$(post ... )". macOS still ships bash
# 3.2, which mis-parses nested double quotes inside "$( ... )": the outer
# quote ends at the first inner one, the result word-splits, and the
# EXPECTED value slides into $4 where nothing compares it. That is not
# hypothetical — it made this suite print "ok  502" for a check wanting
# 409, which is the worst thing a test can do.
#
# The length guard is the backstop: anything that is not a bare 3-digit
# status (a curl error, an empty string, two codes) fails loudly instead
# of being compared as if it meant something.
want() {
  case "$2" in
    [1-5][0-9][0-9]) ;;
    *) bad "$1" "<not a status: '$2'>" "$3"; return ;;
  esac
  [ "$2" = "$3" ] && ok "$1" "$2" || bad "$1" "$2" "$3"
}

# Vercel's own protection answers before the app does, and every check
# would then fail for a reason that has nothing to do with the boundary.
gate=$(anon "/api/records?probe=1")
if [ "$gate" != "200" ]; then
  echo "STOP: probe returned $gate, expected 200. The request is not reaching"
  echo "      the app -- almost certainly Vercel Deployment Protection."
  echo "      Set BYPASS, or turn protection off for Preview."
  exit 1
fi

echo "Testing $SITE"
echo

# ---- who is this token? ---------------------------------------------
MINE=""; THEIRS=""
for f in $FIRMS; do
  case "$(get "/api/records?set=crm&firm=$f")" in
    200) MINE="$MINE $f" ;;
    403) THEIRS="$THEIRS $f" ;;
    401) echo "Token rejected outright (401). It has probably expired."; exit 1 ;;
    *)   echo "Unexpected status probing $f; stopping."; exit 1 ;;
  esac
done
MINE="${MINE# }"; THEIRS="${THEIRS# }"
echo "This token reaches: ${MINE:-(none)}"
echo "It must not reach:  ${THEIRS:-(none)}"
echo
[ -z "$MINE" ] && { echo "Token reaches no firm at all — nothing to assert."; exit 1; }

# ---- the boundary ---------------------------------------------------
if [ -n "$THEIRS" ]; then
  echo "THE BOUNDARY — every one of these must be refused:"
  for f in $THEIRS; do
    got=$(get "/api/records?set=crm&firm=$f"); want "read records      ($f)" "$got" 403
    got=$(get "/api/records?set=lps&firm=$f"); want "read the LP CRM   ($f)" "$got" 403
    got=$(get "/api/records?op=stamps&firm=$f"); want "read change stamps($f)" "$got" 403
    got=$(get "/api/agent?firm=$f"); want "ask the assistant ($f)" "$got" 403
    got=$(get "/api/research?firm=$f"); want "run research      ($f)" "$got" 403
    got=$(post "/api/records?set=crm&firm=$f" '{"overlay":{"patches":{}}}'); want "WRITE an edit     ($f)" "$got" 403
    got=$(post "/api/records?set=crm&firm=$f&op=publish" '{"doc":{"investors":[]},"seen":0}'); want "PUBLISH over base ($f)" "$got" 403
  done
else
  echo "THE BOUNDARY — SKIPPED. This token reaches every firm this"
  echo "  deployment knows about, so there is no refusal to exercise."
  echo "  Run again with a token granted one firm only."
fi
echo

echo "ITS OWN FIRM must be unaffected:"
for f in $MINE; do
  got=$(get "/api/records?set=crm&firm=$f"); want "read records      ($f)" "$got" 200
  got=$(get "/api/records?op=stamps&firm=$f"); want "read change stamps($f)" "$got" 200
done
echo

echo "A TYPO must not silently become the default firm:"
got=$(get '/api/records?set=crm&firm=fiarwind'); want "records ?firm=fiarwind" "$got" 400
got=$(get '/api/records?op=stamps&firm=fiarwind'); want "stamps  ?firm=fiarwind" "$got" 400
echo

echo "UNAUTHENTICATED:"
got=$(anon '/api/records?probe=1'); want "probe stays open and firm-blind" "$got" 200
got=$(anon '/api/records?set=crm'); want "records need a token" "$got" 401
echo

# ---- the firm stamped inside the payload ----------------------------
# Runs against a firm the token HOLDS, so a 403 cannot mask the 409.
one=$(echo "$MINE" | awk '{print $1}')
other=$(for f in $FIRMS; do [ "$f" != "$one" ] && echo "$f" && break; done)
echo "THE FIRM STAMPED INSIDE AN EDIT (against $one):"
got=$(post "/api/records?set=crm&firm=$one" "{\"overlay\":{\"patches\":{}},\"firm\":\"$other\"}"); want "edit stamped '$other' is refused" "$got" 409
got=$(post "/api/records?set=crm&firm=$one&op=publish" "{\"doc\":{\"investors\":[]},\"firm\":\"$other\",\"seen\":0}"); want "PUBLISH stamped '$other' refused" "$got" 409
got=$(post "/api/records?set=crm&firm=$one" "{\"overlay\":{\"patches\":{}},\"firm\":\"$one\"}"); want "correctly stamped edit accepted" "$got" 200
got=$(post "/api/records?set=crm&firm=$one" '{"overlay":{"patches":{}}}'); want "unstamped edit still accepted" "$got" 200
echo

if [ $fail -eq 0 ]; then
  [ -z "$THEIRS" ] && echo "All checks passed — BUT the boundary itself was skipped (see above)." \
                   || echo "All checks passed."
else
  echo "$fail CHECK(S) FAILED."
fi
exit $fail
