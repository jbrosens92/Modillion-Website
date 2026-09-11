MODILLION WEBSITE — REVISED DRAFTS

Files:
- index.html
- team.html
- partnerships.html
- contact.html

Latest changes:
- Compact footer across all pages
- Homepage opening paragraph now specifies real estate operators
- Partnerships page simplified to emphasize the Fairwind partnership visually

Required assets:
- Team headshots, once selected

Partnerships page:
- The Fairwind partnership card is live again as of 2026-08-10, after a short
  period hidden behind a "coming soon" placeholder. Logo, live URL, and layout
  are as they were before.

Contact form:
- Submitting opens the visitor's own email client with the inquiry already addressed to
  info@modillionpartners.com and written out — they press send themselves. No form
  backend, no third-party service, nothing to sign up for or maintain.
- Name, email, and message are required. Company and "regarding" are optional and are
  left out of the email when blank. The subject line is "Website inquiry — <regarding>",
  or "Website inquiry from <name>" when regarding is blank.
- Caveat of this approach: it depends on the visitor having a mail client configured.
  Someone on webmail with no default handler may see nothing happen, so the status line
  under the button also tells them to email info@modillionpartners.com directly.
- If that tradeoff becomes a problem, the fix is a form backend such as Formspree
  (free tier, 50 submissions/month): point the form's action at the Formspree endpoint
  and POST to it instead of building a mailto.

Team page:
- LinkedIn icons currently use placeholder href="#" links.
- Team cards require profile detail destinations or modal behavior.

Latest update:
- Contact hero now aligns vertically with Team and Partnerships.
- Uploaded horizontal Modillion logo is used in the header and footer across all pages.

Latest update:
- Header and footer logos removed for now.

Company Dashboard (dashboard.html) — internal, added 2026-08-17:
- Internal document dashboard. Not linked from any public page and not in the header or
  footer nav; reached by direct URL or bookmark. Carries <meta name="robots" content=
  "noindex, nofollow">, and robots.txt disallows it. Neither is access control — they only
  keep it out of search results.
- IT IS NOT A DOCUMENT DASHBOARD ANY MORE — see "No documents at all" below, which supersedes
  every arrangement above it. There is no folder mirror, no document index, and nothing is read
  from OneDrive, Graph, Dropbox, Drive or object storage. Five record sets: deals, operators,
  investors, tasks, competitors.
- Two states. It opens on a gate and switches to the dashboard once signed in.
- What it does: a deal pipeline with the operator behind each deal, where it stands and the
  debt on the ones the firm owns; two CRMs; a task list; a competitor tracker; and an agent
  across all of them.

No documents at all — 2026-08-20, and it SUPERSEDES every document section in this file:
- THE DECISION: the dashboard tracks DEALS, OPERATORS, INVESTORS AND TASKS. It does not carry
  documents, does not index them, and does not read any folder. The Asset Management tab is
  gone and the Deal Pipeline is a list of deal records, like the two CRMs beside it.
- WHY, and it is about adoption rather than engineering. A tool that needs a synced OneDrive
  folder, a snapshot script and a published index is a tool ONE PERSON MAINTAINS. Four people
  can open a tool backed only by records. The document side can come back later if it earns
  its keep; nothing in this design prevents it.
- The two days before this went into serving the documents — Microsoft Graph against a
  consumer account, then Dropbox, then Google Drive, then object storage — and every route hit
  the same wall from a different side: an OAuth flow with no tenant behind it, or a 2.47 GB
  copy that outgrew the free tier holding it. The last arrangement published a 244 KB index of
  997 file NAMES and stored no file contents. This removes that too.
- WHAT WAS ACTUALLY LOST, said plainly, because it worked: folder browsing, the sortable file
  tables, search across document names, the eight "By document type" cards, the PDF preview
  modal, and the Excel exports that walked the tree. About 1,700 lines of dashboard.html.
- WHAT WAS KEPT. tools/extract-deals.py read the index before it was deleted and produced
  deals-data.json: 22 deals (19 active, 3 closed), 17 of them matched to an operator by the
  folder naming convention, and the three debt rows joined onto the closed deals they belong
  to. The debt roll-up — lenders, balances, rates, maturities — survives as FIELDS ON A DEAL
  RECORD that people type into. That script has done its job and can go whenever; it is kept
  because it documents where the records came from.
- THE ONE FILE WHOSE CONTENTS WERE EVER OPENED was the debt workbook, and it is not opened any
  more. openpyxl, exceljs and @vercel/blob all left with it.
- The debt values are STRINGS, printed exactly as written — "$16,650,000", "Oct 15, 2029". No
  arithmetic is done on any of them and a blank stays blank. A loan shown against the wrong
  building is a number somebody acts on, so nothing here infers anything.

Deals are a record set now (?set=deals) — 2026-08-20:
- They used to live in the INVESTOR CRM's overlay as `dealsAdded`: a deal existed because a
  OneDrive folder existed, and a deal without one was the exception, shown marked "No folder
  yet". With no folders left, that exception is the only case, so deals became the fourth set
  alongside crm, operators and tasks. Adding a set to /api/records is one whitelist entry.
- The eleven deal methods that hung off Crm — dealStatus, setDealStatus, addedDealRecords,
  addDeal, hideDeal and the rest — moved to Deals, and the twenty-three call sites across both
  CRMs, the task list and the agent were repointed. THE OLD NAMES SURVIVE ON PURPOSE, in a
  compatibility block at the bottom of the Deals module: everything outside this tab refers to
  a deal BY NAME because that is what it referenced when a deal was a folder, and Deals.byName()
  is the join all of it depends on. Rename a deal and those references stop finding it — which
  is exactly as true as it was before.
- Deals.status() returns null for a deal that is simply Live with nothing recorded against it.
  "Live" with no reason and no date is the ABSENCE of a status, not a status, and the callers
  render a pill only when something has actually been said. That is how dealStatus read when it
  was a map with no entry for most deals; keeping it that way kept nine call sites honest.

Everything lives in Vercel now — 2026-08-20, and it SUPERSEDES "The shared edit layer
(/api/overlay)" which stood here for one day:
- WHAT WAS WRONG WITH THE ARRANGEMENT IT REPLACES. Base records were committed to git; edits
  lived in a shared overlay. Making an edit permanent therefore meant: download crm-data.json,
  drop it in the site folder, commit, push, wait for a deploy. Every person, every time. And it
  only worked at all because the repository had been made private, since those files carry real
  investor and sponsor names — which left a standing hazard, that making it public again without
  purging history publishes every one of them.
- Both problems have the same fix: take the data out of git. The loop disappears, because a
  button can write to a store and cannot write to a git repository. The hazard disappears rather
  than being managed, because the names never enter history in the first place. THE REPOSITORY
  IS PUBLIC AGAIN AND HOLDS ONLY CODE.

One store — UPSTASH REDIS, read and written by /api/records. About 35 KB across all four sets,
edited by hand, written by several people at once. There was briefly a second store, Vercel
Blob, holding the document index; it went with the documents on 2026-08-20 and
BLOB_READ_WRITE_TOKEN is no longer read by anything — the Blob store can be deleted in Vercel.
Redis was chosen over Blob for two specific reasons, and both were REAL DEFECTS in the version
it replaced, not preferences:
    1. A Vercel Blob object has a public URL that never changes. Nothing hands it to the browser,
       but it would keep answering from OUTSIDE any sign-in wall added later — a gate that looks
       like it protects records while the store sits open beside it.
    2. Read-modify-write over a blob loses concurrent writes. Edits are now RPUSHed onto a Redis
       list, which is atomic, so simultaneous writers cannot clobber each other AT ALL. That is
       not a narrowed race. There is none.

Base and overlay are still separate, and that is deliberate:
- It would look tidier to fold every edit into the base and serve one document. It would also
  mean re-implementing, on the server, the several hundred lines in dashboard.html that know how
  a patch applies to an investor, how a conversation is appended, how a tombstone hides a deal.
  So the split stays and THE SERVER STAYS IGNORANT: it stores two documents and unions the
  deltas; the page merges base + overlay exactly as it always has. Nothing that understands a
  record had to move, which is why this change was small enough to trust.
- PUBLISH is the seam where they meet, and it is the dumbest possible operation. The page
  already computes the fully merged document — that is what "Download" hands you, from toFile()
  — so publish stores that as the new base and drops the deltas it accounted for. The server
  still never has to understand a record.
- The order is the cautious way round: base first, overlay cleared second. A failure between the
  two leaves edits applied twice, which the union merge makes a no-op. The other order loses them.
- "Publish to team" sits next to "Download" on all three record tabs. Download is now a BACKUP,
  not a step anybody has to take.

Other people's edits arriving without a reload — added 2026-09-11:
- WHAT THIS CLOSED. Saving was already instant in one direction: an edit becomes a delta in the
  shared overlay the moment it is made, and it is the team's from that instant. The other
  direction was not. Nothing on the page ever asked the store whether anything had changed, so a
  colleague's work showed up only when somebody happened to reload — the source line said so, in
  those words. Two people on the same list at the same time could not see each other, which is
  the state a shared list exists to prevent.
- IT IS NOT WHAT PUBLISH DOES, and this is worth being clear about because the two get confused.
  Publishing folds the accumulated deltas into a fresh base. It is housekeeping. It has never
  been what makes work visible, so publishing on every edit would not have fixed this — it would
  have rewritten a whole document per keystroke and made writes MORE likely to land on top of
  each other, while still leaving every screen stale until somebody pressed F5. What was missing
  was nobody ever asking whether anything had changed.
- THE CHANGE STAMP is what makes asking cheap. One integer per set, bumped by every append and
  every fold. GET /api/records?op=stamps returns all six and the records themselves are fetched
  only for a set whose stamp actually moved, so a quiet team costs one small poll and nothing
  else — measured: 20 seconds idle with two browsers open is 14 polls and ZERO record reads.
- ALL SIX STAMPS LIVE IN ONE REDIS HASH, which is a billing decision as much as a tidy one.
  Upstash charges by the command, not by the request, so six GETs pipelined into one HTTP call
  is still six commands. HGETALL is one. At a two-second poll with four people that is roughly
  60,000 commands a day rather than 350,000, and it is what makes a poll this fast reasonable
  to leave running all day. If the cadence is ever raised again, this is the number to check.
- A browser records the stamp its own writes produce, so nobody pulls a set back down to
  discover the change was their own. Without that, every save anybody made would cost every
  browser a full re-read, including the one that made it.
- NEVER UNDER SOMEBODY'S HANDS. Incoming data is merged the moment it arrives — safe, because
  the merge is a union and cannot lose what is being typed. The REPAINT is what waits: a record
  open in its edit form, or a cursor in any field, defers the redraw until the field is
  released. The test for "in any field" is deliberately coarse rather than five per-tab flags,
  because the tabs that edit a row in place keep no flag to read, and a list redrawing under a
  half-typed row is the one outcome worth being clumsy to avoid.
- CADENCE. Two seconds when the tab is visible, twenty when it is not — less often, never
  nothing. Browsers throttle and eventually freeze timers in a tab they believe is hidden, and
  some embedded and pinned tabs believe that while sitting in front of a reader, so a click or a
  keypress also wakes the poll. A dashboard that had quietly stopped listening while still
  saying "edits are shared" is the one failure this must not have.

Tested 2026-09-11, two browsers on two ports so they had genuinely separate localStorage:
- A task added in one appeared in the other 4.1 seconds later with NO reload and no interaction
  in the receiving tab — and that 4.1s is the whole round trip, including the click, the save
  debounce and the poll. The page instance was confirmed to be the same one.
- With a half-typed line in the receiving tab's own box, the list did NOT redraw and the typed
  text survived; it redrew the moment the field was blurred, showing the change that had been
  waiting.
- Untouched sets were read only at boot. Twenty seconds idle across two tabs produced fourteen
  stamp polls and zero record fetches.
- readStamps was unit-tested against both shapes Upstash can answer HGETALL with — an object and
  a flat [field, value, …] array — plus an empty hash and no reply at all, which all read as
  zero. A stamp hash that has been flushed therefore costs one refresh per page, not a fault.
- The one publish seen in a window was AutoPublish firing after its quiet period; the two reads
  around it are its own pre-publish load and the other tab noticing the new base, which is
  correct rather than churn.

Why concurrent editing needs no locking, which is luck rather than design:
- The overlays already recorded DELETIONS AS TOMBSTONES rather than as absent keys — removed[id],
  convRemoved, dealsHidden, an alias marked { forgotten: true } — so that re-loading a newer
  crm-data.json would not resurrect what people had withdrawn. That makes every edit, including
  every delete, an ADDITION. Merging is therefore a union, a union needs no lock and no conflict
  UI, and last-write-wins applies per FIELD rather than per file.
- ITS COST: an overlay only ever grows. A key removed locally comes back on the next merge,
  because "absent" is not a statement this format can make. Right for withdrawing a record,
  wrong for undoing one, which is why there is no undo. Read that before adding one.
- Overlay lists are compacted at 40 entries, by a Lua script that trims exactly the entries that
  went into the fold and pushes the fold in their place, atomically. It has to be exactly that:
  a DEL-then-RPUSH lets a reader see an empty overlay — every edit apparently withdrawn at once
  — and a blind trim silently discards whatever was saved while the fold was being computed.

Server environment (Vercel project settings, not files):
    KV_REST_API_URL           from the Upstash integration
    KV_REST_API_TOKEN         from the Upstash integration          <- credential
    DASHBOARD_WRITE_KEY       optional, and see below                <- shared secret
    DASHBOARD_ALLOWED_ORIGIN  optional, same meaning as in notify.js
- UPSTASH_REDIS_REST_URL / _TOKEN are accepted as alternatives, because which pair you get
  depends on whether the store was created through Vercel's integration or directly at Upstash,
  and that is not worth a support conversation later.
- With no store configured /api/records returns 503 and the dashboard falls back to the local
  JSON files and its own localStorage overlay — behaving exactly as it did before any of this
  existed. That is the NORMAL unconfigured state, not a failure, which is why the page falls
  through it quietly and tells the reader nothing.

Setting it up, in order:
  1. Vercel dashboard -> Storage -> Upstash Redis (Marketplace) -> connect to this project.
     KV_REST_API_URL and KV_REST_API_TOKEN are injected; nothing to copy.
  2. Optionally set DASHBOARD_WRITE_KEY, then have each person run modillionWriteKey("...") once
     in their browser console.
  3. Redeploy, then seed the store from this folder:
         export DASHBOARD_WRITE_KEY=...        # only if you set one
         python3 tools/publish.py --dry-run    # says what it would send, sends nothing
         python3 tools/publish.py
- tools/publish.py TALKS TO THE SITE, NOT TO THE STORE. This machine holds only the write key;
  the one place that speaks to Redis is the server, where the credentials already live.
- PUBLISHING REPLACES THE BASE AND CLEARS THE SHARED EDITS, because the file being sent already
  contains them. Send a STALE export and you roll the team back to it. Prefer the dashboard's
  "Publish to team" button — it sends what is on screen and cannot be out of date. publish.py is
  for the initial seed.

DASHBOARD_WRITE_KEY IS A LOCK, NOT AUTHENTICATION:
- One shared string, typed into each browser once and kept in localStorage, so it is NOT baked
  into the published page and does not appear in view-source. It is still readable from the dev
  tools of any browser holding it, and it says nothing about WHO is writing.
- What it buys: a URL turning up in a log does not let a stranger rewrite the firm's investor
  records anonymously. That is worth ten lines and it is all it is worth.
- READS ARE NOT GATED AT ALL. Anyone with the URL gets the records, conversation notes included.
  Same posture as the rest of the dashboard — a decision, deferred deliberately, not an oversight
  — and the first thing to fix if this ever needs to be private. Moving to Redis makes that
  easier later, because the store itself is no longer reachable from outside the functions.

Verified 2026-08-20, with no deployment and no store:
- /api/records driven through 45 cases with REDIS FAKED BEHIND A STUBBED fetch — so the actual
  command strings this code sends (RPUSH, LRANGE, EVAL, SET, DEL) are what got exercised, not a
  mock of the functions that build them.
- Covered: two writers editing one investor and both surviving, and the same for one deal;
  45 patches folded by compaction with none lost; publish replacing the base and clearing the
  overlay; the four sets staying apart; the write lock; the origin check; and every 503.
- The server and browser copies of the union merge were run against the same 12 inputs and agree
  on all of them. They are duplicated deliberately — if they drift, the two disagree about what
  was deleted. Keep testing them against each other.
- In a browser against a local server: five tabs with Asset Management gone, 22 deals listed
  with no document index present anywhere, the four local files loaded after /api/records 503s,
  no JS exceptions, and the deal pickers on both CRMs and the task list carrying 22 / 19 / 44
  entries with no duplicates.
- THE WRITE PATH WAS FINALLY WATCHED END TO END, which had never happened before: opening The
  Arden, editing its note and status, saving, and finding the patch in localStorage under
  modillion-deals-overlay with the right statusSetAt — plus the toast correctly reporting that
  the shared store was unreachable. The debt report rendered all three properties, and the
  operator deal-tag opened its deal on the pipeline.
- TWO REAL BUGS CAME OUT OF THAT, neither of which the parse check could see. A stale
  $("wsAssets") left in switchTab() threw on every tab change, which is why a deal tag switched
  tabs without opening anything. And dealNames() feeding both halves of a concat listed every
  deal twice in the CRM picker. Parsing clean is not the same as working.
- WHAT IS STILL NOT COVERED: Upstash itself, because there is no Node on this machine and no
  store to point at. It is exercised for the first time on the deployed site.

Connecting OneDrive — BUILT, NEVER DEPLOYED, DELETED 2026-08-20:
- api/onedrive.js walked a OneDrive folder through Microsoft Graph and returned the same
  JSON the snapshot script wrote; tools/onedrive-authorize.py minted the refresh token it
  needed. Both were checked against the Python tool field by field and agreed on all 958
  files. Neither was ever deployed, and neither held a credential.
- The blockers are worth remembering, because they are what any future document feature
  runs into: a PERSONAL Microsoft account has no tenant, so there is no app-only access and
  no client-credentials flow — only a delegated token, refreshed from one that dies after
  90 days idle, behind a client secret that expires on its own timer. Dropbox and Google
  Drive have the same shape of problem with easier paperwork; object storage has none of it
  but wants a 2.47 GB copy that outgrows every free tier.
- Deleted rather than kept dormant, because a 750-line file nothing calls is a file somebody
  eventually believes. It is in git history if it is ever wanted.

The interim sign-in (dashboard.html) — username and password, added 2026-08-18:
- Four accounts, one per person on the team, with a SHARED password. Usernames are the
  modillionpartners.com addresses; the password is handed out in person, not written here.
- IT IS A SPEED BUMP, NOT ACCESS CONTROL, and the gap is bigger than "the password is weak".
  The check runs in the browser on a page that is publicly served, so getting past it does not
  mean breaking anything — anyone who opens dev tools can set the session flag directly and
  skip the form. The page ships no records of its own, which is the only reason that is
  tolerable. Nothing real is behind it because nothing real is in it.
- So what is it FOR? Identity, not secrecy. The page never knew who was looking at it: "Mine"
  on the task list and the name in the corner had to be chosen from a dropdown, per browser.
  Now they follow whoever signed in. That is a genuine improvement and it is the whole benefit.
- Stored as PBKDF2-HMAC-SHA256, 310,000 iterations, a random 16-byte salt per account. That is
  about the FILE, not the gate: it keeps the plaintext out of this public repository and stops
  the hashes being a rainbow-table lookup. It does not make the gate harder to walk around.
- TREAT THE PASSWORD AS PUBLIC. It is weak, it is shared, and a hash of it sits in a public
  repo next to four valid usernames — which is a ready-made list for anyone spraying the real
  Microsoft 365 tenant. It must never be the password to anything else, and above all not the
  real M365 password for these accounts. If it ever was, change that one now.
- To change the password or the roster, regenerate the salts and hashes rather than editing
  them by hand:
      python3 - <<'EOF'
      import hashlib, os
      pw = "NEW PASSWORD HERE"
      for u in ["dwolfson", "cernst", "eemrich", "jbrosens"]:
          salt = os.urandom(16)
          print(u, salt.hex(),
                hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 310000, 32).hex())
      EOF
  then paste the salt/hash pair into GATE_USERS in dashboard.html. The `id` on each account
  matches the task-list roster (dw / ce / ee / jb), which is what lets signing in also answer
  "who is Mine" without a second list of people to keep in step.
- An unknown username is still hashed against a throwaway salt before it is rejected, so the
  box cannot be used to work out who has an account, and the error never says which of the two
  fields was wrong.
- Sign out clears the session and the signed-in name, and empties both fields.
- THAT SIGN-IN IS NOT COMING, and this section has to be read differently now. The OneDrive
  connection built on 2026-08-19 does not sign the READER in to anything: the server holds one
  delegated token for the account owner and answers everybody with it. So getUser() still has
  no real account to carry, and the gate is still the only thing naming who is looking.
- Which means: keep it for identity, and stop thinking of it as a door. Real documents are now
  behind it, and it cannot hold them — /api/onedrive answers the browser directly and never
  asks whether the form was passed. Anyone who fetches the endpoint has the whole tree.
- If the dashboard should be private again, put Vercel edge Basic Auth or Vercel Authentication
  in front of BOTH dashboard.html and /api/onedrive. Covering only the page does nothing; the
  endpoint is where the documents come from.

Local preview:
- MSAL redirects will not work from file://, so serve the folder over http:
    python3 -m http.server 8000
  then open http://localhost:8000/dashboard.html


The Deal Pipeline tab (dashboard.html) — REBUILT AS RECORDS 2026-08-20:
- It was a folder browser: area cards, a breadcrumb, a sortable file table and a search
  across document names. It is now a filtered list of deal records with a detail view,
  the same shape as the two CRMs beside it. The internal id is still "docs" — it is wired
  through the tab switch, the print rules and the agent's context — so only what it shows
  changed.
- Columns: Deal, Operator, Where, Status, Market, Asset class. Filter by area, status or
  operator; search across all of it. Sorting puts a BLANK LAST whichever way the column
  points, because an unfilled field is not a small value, it is an absent one.
- The detail view carries the debt block when the deal has one, and an Edit form that
  writes through Deals.patch. "Add deal" is unchanged apart from losing the paragraph
  explaining that it would not create the OneDrive folder.
- Deleting a deal ARCHIVES it: the record leaves the list and stays in the file, the same
  rule both CRMs follow.

Investor CRM (dashboard.html, "Investor CRM" tab) — added 2026-08-17:
- Tracks investor conversations: who the investor is, what type (family office, institutional,
  endowment, GP-stakes fund, platform), check size, which deals they are interested in, the
  research on them, and a dated log of every conversation.
- THE DATA RULE CHANGED TWICE IN TWO DAYS; this is where it landed. crm-data.json is GITIGNORED,
  as it always was, and the live records are in the shared store — see "Everything lives in
  Vercel now" above. The file here is the seed that store was filled from and the offline path
  when it is unreachable. The deployed dashboard shows the real records rather than falling back
  to CRM_FALLBACK, the line above the table says which source answered, and edits are no longer
  trapped in one browser: they save to the team, and "Publish to team" makes them the new base.
- The starter list holds nine researched prospects — GP-stakes buyers, multi-family offices,
  two North Carolina endowments and one distribution platform. They are named in crm-data.json
  and deliberately NOT listed here: who the firm is approaching for capital is not something to
  publish in a public repository. Every fact on each record carries the source URL it came from
  and the date it was checked. NO CONVERSATION WAS INVENTED — every log starts empty. Check size
  is blank on most of them because it is genuinely not public; that field is for what they tell
  you.
- Sort on any column; filter by type, ASSET CLASS, stage or deal interest; search runs across
  names, mandates, research notes and conversation text at once.
- Asset class (added 2026-08-18) is what the investor wants to own — multifamily, retail,
  industrial, office, life science and so on, several per record. It shows in the facts grid and
  as a column on the list, filters, searches and exports. It uses THE SAME VOCABULARY as asset
  strategy on the Operator CRM on purpose: "who would want this deal" is then a question you
  answer by reading down two columns. It is edited on the record, not through the agent — the
  agent's diff compares single values, and a list needs list-aware before/after lines.
- Two exports: "Export Excel" gives three sheets (Investors / Conversations / Research);
  "Download crm-data.json" gives the merged file, including deal statuses and learned aliases.
- Note on the deals field in a draft: folder names contain commas — "Sponsor - Asset Name
  (City, ST)" — so that box does NOT split on commas, which would tear every name in
  half. Known folder names are matched whole (with autocomplete); separate anything else with
  a semicolon.

How edits are saved (this matters):
- The page is static and cannot write to disk. Anything logged in the browser is held in a
  localStorage overlay, and an amber "Unsaved local edits" marker appears while it is there.
- To make those edits permanent: click "Download crm-data.json" and drop the file into the site
  folder, replacing the old one. The overlay stores only additions and patches keyed by
  investor id, so re-loading a newer file does not lose local entries and does not duplicate
  what the file already contains.
- The overlay is per-browser. Two people logging conversations on two machines will not see
  each other's until the file is exchanged. That is the honest limit of a static page — a
  shared CRM needs a backend, which is a separate piece of work.

The agent — "Tell the agent":
- Two things go in the same box, and which one you get depends on whether you wrote an
  instruction or a description. This split is mechanical, not a judgement call about tone:
  an explicit edit verb (remove, drop, set, change, mark, assign, archive) or a deal-death
  phrase ("fell through", "on hold", "has closed") means an edit. Everything else is a note.
- DESCRIBE A CONVERSATION and you get a draft log entry: investor, date, channel, stage, who
  was on it, check size, deals discussed, summary, next step. Nothing saves until "Add to log".
- GIVE AN INSTRUCTION and you get a before → after diff with a checkbox per line. Nothing
  applies until "Apply changes". It handles: stage, owner, priority, type, location, check
  size; adding and removing deal interest; marking a deal live/on hold/dead/closed; archiving
  and restoring an investor. Several instructions in one sentence work — "set owner to AB for
  North Quay and change priority to high" — and a clause that names nobody inherits the investor
  from the clause before it.
- If it reads an instruction into something you meant as a note, "Log it as a note instead"
  is on the diff. If it understood you but there was nothing to change, it says so rather than
  quietly logging a note ("that deal is not on their list, so there is nothing to remove").
- It tells you what it did and why: "matched on the firm name", "read as the most recent
  tuesday", "learned — you mapped 'wake forest one' to this".
- On save it also rolls the record forward — stage, deal interest, and a check size if one was
  discussed and none was on file.
- ARCHIVE IS NOT DELETE. Archived investors leave the list but stay in the file with their
  conversations, and "restore <name>" brings them back. Nothing in the CRM hard-deletes
  a record — the log is often the only history of who said what, and a mistyped name should
  not be able to destroy it.
- DEAL STATUS IS A CRM-SIDE NOTE. Marking a deal dead strikes it through and badges it
  everywhere it appears, including the deal rows on the Deal Pipeline tab, and drops it out of
  pickers. The OneDrive folder is untouched — the dashboard mirrors that folder, it does not
  own it, and nothing in this page should be able to reach into it.

What the agent learns:
- Only from corrections you actually make. Change the investor or add a deal it missed, and it
  records the phrase that misled it as an alias — "wake forest one" means the Pointe at
  Heritage folder. Next time that phrase appears it matches on its own, and the draft says it
  matched because you taught it.
- Nothing is learned from a draft you accepted unchanged, and nothing is inferred in the
  background. It stores phrase → record mappings and nothing else. It does not adjust its own
  matching rules: rules that drift without anyone watching are how a CRM quietly fills with
  wrong data.
- Everything it has learned is listed under "What the agent has learned" below the table, with
  a use count and a Forget button per entry. If a mapping is wrong, forget it and it is gone.
  Learned aliases travel with crm-data.json, so exporting the file shares them with the team.
- It is a deterministic parser, NOT a language model, and that is deliberate. This page is
  served publicly and can hold no secrets: an API key in page source is a key anyone can spend.
  The chat agent described below is the route to a real model — this box stays deterministic
  because it is the careful route: every field of the draft is editable before it is saved, and
  it is what teaches the aliases.
- Known rough edge: stage is the weakest guess. A message saying "I'll revert with our diligence
  list" reads as "In diligence" when it is really still an intro. Correct it in the draft.

Operator CRM (dashboard.html, "Operator CRM" tab) — added 2026-08-18:
- The other side of the table from the Investor CRM. That one tracks who gives the firm capital;
  this one tracks the sponsors and operators the firm invests alongside — what it does with them
  (Co-GP equity, seed), what they build (multifamily, retail, industrial), where they build it,
  which live deals are theirs, how they are prioritised and what they run.
- Columns: Company Name, Stage, Investment Type, Asset Strategy, Market Focus, Deals, Priority,
  AUM.
  Investment type, asset strategy and market focus each hold SEVERAL values — an operator can be
  Co-GP and seed, multifamily and industrial, "Southeast, Texas, Florida" — so those cells are
  tag stacks, and the filters match on any one of them.
- DEAL TAGS ARE LINKS. Clicking one switches to the Deal Pipeline tab and opens that deal's folder
  under Active Deals. Only names that match an Active Deals folder become links; anything else
  stays a plain tag rather than promising a folder that is not there. A deal marked dead or on
  hold in the Investor CRM carries the same strike-through here — one deal status, read
  everywhere.
- Same data rule as everything else. Real records live in operator-data.json, GITIGNORED and
  never deployed. The committed page falls back to OPERATOR_FALLBACK, three invented firms. The
  line above the table always says which of the two is loaded.
- What is in the starter file, and what is deliberately not: the thirteen company names and the
  deals against them are READ OFF the live Active Deals folders in dashboard-data.json, so they
  are facts, not guesses. Market focus is filled in only where the folder name itself states the
  market (Houston TX, Durham NC, Westchester NY). Stage is "Active partner" for all thirteen
  because each one has a live deal in the pipeline — also read off the folders, not guessed.
  Investment type, asset strategy, equity per deal, priority, AUM, owner, founded, track record,
  GP co-invest, vertical integration, last contact and contacts are LEFT BLANK — they are not in
  the folder structure and nothing was invented to fill them. The tab shows a blank field as "not recorded" rather than a zero.
  Two Active Deals folders carry no operator prefix (Programmatiq, Workforce Housing Portfolio)
  and are not assigned to anyone; attach them by hand once it is known who runs them.
- Each record also carries the fields the Investor CRM carries, so the two tabs read alike
  (added 2026-08-18): STAGE (Prospect / Contacted / In diligence / Active partner / Passed /
  Dormant, shown as the same pill), EQUITY PER DEAL (the operator's answer to check size — a
  range becomes numbers the list can sort on, anything else is kept as written), OWNER (from the
  task list roster, the same single copy the Investor CRM reads), CONTACT with title and email,
  and LAST CONTACT. Last contact is TYPED IN here rather than derived: conversations are logged
  against investors, not operators, and a derived-looking field with nothing behind it would lie.
- And the fields that only matter for an operator: FOUNDED, TRACK RECORD, GP CO-INVEST and
  VERTICAL INTEGRATION — the four things asked on every sponsor call — plus free TAGS.
- Sort on any column — AUM sorts on the figure behind the text, so $1.4B ranks above $640M, and
  stage sorts by rank rather than alphabet. Search runs across names, strategies, markets, deals,
  track record, notes and contacts at once. Filter by investment type, strategy, market, stage
  or priority.
- "Add operator" opens a blank form; clicking a row opens the record, and "Edit" opens the same
  form on it. A company name is the only required field.
- The multi-value boxes take commas — "Co-GP Equity, Seed". THE DEALS BOX TAKES SEMICOLONS,
  because deal folder names contain commas ("Sponsor - Asset (City, ST)") and splitting on those
  would tear every name in half. Same reasoning as the deals box in the CRM draft form.
- A value typed into a record joins the pickers on the next render, so a new market or strategy
  does not need this page edited. The starting vocabularies also live in operator-data.json and
  can be widened there.
- Archive is not delete, same as the Investor CRM: the record leaves the list and stays in the
  file. Clearing local edits in the browser brings it back.
- Edits are held in a localStorage overlay with the same amber "Unsaved local edits" marker and
  the same limit — two people on two machines see two different lists until the file is
  exchanged. "Download operator-data.json" writes the merged file to drop back into the folder.
- Exports: "Export Excel" gives two sheets — Operators, with every field on the record, and
  Deals by operator, one row per operator-deal pair with the operator's stage and the deal's
  status, the shape a pivot wants.
- The chat agent can READ this tab (ask it which operators are in Texas, who is on East Blocks,
  or who the owner is) but cannot change a record. Operator edits go through the form, where every field is
  in front of you; giving the agent an action vocabulary for a fourth dataset is a separate job.

Competitor Tracker (dashboard.html, "Competitor Tracker" tab) — added 2026-08-25:
- The Operator CRM turned around. That one records the firms this one invests ALONGSIDE; this
  records the firms it is in the room AGAINST — the other people writing Co-GP cheques, seeding
  sponsors and backing operators. It sits to the right of the Task List, and the fifth record
  set (?set=competitors) went in with it.
- WHY IT IS A SEPARATE LIST rather than a flag on an operator. A firm can be both, and when it
  is, the two records answer different questions: on the Operator CRM, "what are we doing with
  them"; here, "what are they doing that we are not". One record trying to hold both would mean
  one set of fields doing both jobs, and the field that decides everything on this tab — how
  directly they overlap — has no meaning at all on the other one.
- Columns: Company Name, Overlap, Capital Type, Asset Strategy, Market Focus, Articles,
  Priority, AUM, Added. Capital type, asset strategy and market focus are tag stacks holding
  several values, exactly as on the Operator CRM, and the filters match on any one of them.
- OVERLAP IS NOT A STAGE, and it carries its own attribute rather than borrowing [data-stage]
  so nothing can start reading one as the other. A stage is where a relationship has got to and
  moves one way; overlap is a judgement about how directly a firm competes and can go either way
  in a week. Direct / Adjacent / Emerging / Watching / Not competing, ordered most-competitive
  first, and coloured the opposite way round to a pipeline — "Direct" is the one to look at, not
  the one to celebrate. The line above the table says out loud that it is a judgement somebody
  wrote down, not a measurement.
- ARTICLES ARE THE POINT OF THE TAB. A competitor is mostly learned about by reading, and a link
  that stayed in one person's inbox is a thing nobody else knows. Each article is a headline, the
  publication, the date it ran, and ONE LINE ON WHY IT MATTERED — that last field doing more work
  than the link, because a URL saved with nothing beside it is a 404 with no memory attached a
  year later. The list column shows the count and the newest date, which is what "have we looked
  at this firm lately" actually means.
- The add-article form sits OPEN on every record rather than behind a button: pasting a link is
  the commonest thing anybody will do here, and a form you have to reveal first is one that gets
  skipped in favour of not recording it at all. A link is enough on its own; the rest can follow.
  A URL already on the record is refused rather than filed twice, and a link with no http:// is
  refused rather than saved as something that will not open. Enter files it from any of the
  single-line boxes.
- Articles carry IDS, so the shared overlay unions two people's additions instead of doubling
  them — the same rule conversations follow on the Investor CRM, and the same rule that fixed
  contacts appearing two, then four, then eight times.
- "Look it up with Claude" calls /api/research with kind:"competitor", which asks the same
  machinery a different question: not "who is this firm" but "what has been written about them
  lately". It PROPOSES — nothing is filed until somebody has read it, which matters more here
  than on an investor record, because a firm's own press release and a reporter's account of the
  same week are not the same document and only one of them is worth filing. A piece with no
  openable link is dropped server-side; a piece the model could not date comes back undated and
  says so, rather than carrying a guessed date that would sort wrongly against hand-filed ones.
  With no ANTHROPIC_API_KEY the button says so and the paste-it-in form is unaffected.
- Fields beyond the Operator CRM's: CAPITAL BASE (where their money stands — "Fund III, $400m,
  closed 2025"), BACKED BY (whose money it is), WATCHED BY (whoever here keeps an eye on them,
  from the same task-list roster both CRMs read), and WHAT THEY DO THAT WE DO NOT — the honest
  version, because a tracker that only records where a rival is weaker is one nobody learns
  anything from. CHEQUE PER DEAL parses like the operator's equity per deal and the investor's
  check size: a range becomes numbers the list can sort on, anything else is kept as written.
- THE SEED FILE SHIPS EMPTY, and that is deliberate. There is no folder to read rival firms off
  the way operator names were read off Active Deals, so seeding it would mean inventing them —
  and an invented competitor is one somebody eventually repeats in a meeting. The vocabularies in
  competitor-data.json are starting pickers, not claims about anybody. The empty state says this
  rather than looking broken.
- Everything else is the Operator CRM's machinery unchanged, which is the point: sort on any
  column (AUM on the figure behind the text, overlap by rank rather than alphabet), search across
  every field AND across article headlines and takeaways, filter by capital type, strategy,
  market, overlap or priority, edit a row where it sits, drag rows into a hand-set order, archive
  rather than delete, and the same "Publish to team" / "Download competitor-data.json" pair.
  Row editing shows the article count as static text and says to open the record — every other
  field on a row is one value in one box, and an article is four.
- Exports: "Export Excel" gives two sheets — Competitors, with every field on the record, and
  Articles, one row per piece newest first, carrying the takeaway. A spreadsheet of bare URLs
  would be the same dead links in a different file.
- competitor-data.json is GITIGNORED with the other four. The names in it are public firms, but
  what is written in the overlap, edge and notes fields is an internal read on named rivals.
- The chat agent can READ this tab — which firms are Direct, who else writes Co-GP in Texas, what
  has been written about them — but cannot change a record, on the same terms as the Operator
  CRM. Each article reaches the agent as its headline, publication, date and takeaway; the bare
  URL is left out, since it would only make the snapshot bigger without answering anything.

Asset Management — REMOVED 2026-08-20:
- The tab, the derived area, the property grid and the workbook-backed debt report are all
  gone. It was a VIEW of the closed deals' folders, so with the folders gone there was
  nothing left for it to be a view of.
- The debt roll-up survives as fields on a deal record — lender, balances, rate, maturity,
  typed in rather than read out of a workbook — with a "Debt report" button on the Deal
  Pipeline toolbar that tables them across the closed deals. It stays hidden when no deal
  carries debt, rather than opening an empty report.
- match_property() from the snapshot tool was ported into tools/extract-deals.py before the
  deletion, ordering intact, to join the three workbook rows to the deals they belong to.
  A loan shown against the wrong building is a number somebody acts on, so no match beat a
  wrong one there and the same rule applies to anything that replaces it.

Reading a PDF without leaving the page — REMOVED 2026-08-20:
- The preview modal went with the documents. Nothing on the page opens a file any more.

Task List (dashboard.html, "Task List" tab) — added 2026-08-17:
- Third workspace, independent of Documents and the CRM. Company to-dos, assigned to a person,
  with a due date, a priority, a status and an optional link to a deal or an investor.
- Same data rule again. Real tasks live in tasks-data.json, GITIGNORED and never deployed —
  task titles name live deals, investors and internal deadlines. The committed page falls back
  to two invented tasks and two invented people. The team roster in tasks-data.json is taken
  from the public team page, so it holds nothing that is not already on the website.
- Grouped by when things are due — Overdue (in red), Today, Next seven days, Later, No date,
  Done — because that is the order the list actually gets read in. Within a group it sorts by
  date then priority.
- The default view is what is still open. Done has to be asked for, via the status filter.
- Tick the box to close a task; it stamps the date it was closed. Untick to reopen.
- Filter by assignee (including "Mine" and "Unassigned"), status and priority; search across
  titles, notes, links and assignee names.
- Click a task title to edit it in the form at the top — same fields, plus a Delete button.
- Exports: "Export Excel" gives a single Tasks sheet including created and completed dates;
  "Download tasks-data.json" gives the merged file.

Adding a task in one line:
- Type it the way you would say it and the fields fill in underneath: an assignee (first name,
  full name, or @mention), a due date, a priority, and a link to a deal or investor.
  "Send the DDQ to North Quay by Friday, Dana, high" reads as assigned to Dana, due the
  coming Friday, high priority, linked to the North Quay record.
- Task dates point FORWARDS — "by Friday" is the Friday coming, not the one just gone, which is
  the opposite of how the CRM reader treats "on Tuesday" in a conversation note. Also handles
  today, tomorrow, next week, end of week, end of month, 9/30 and "September 30".
- The title keeps your original wording. Stripping out the parts it recognised would leave
  sentences that read oddly, and the fields below already show what it took.

"Signed in as", at the bottom of the tab:
- There is no real identity in this page yet, so "Mine" and the default assignee need one to be
  picked. It is stored per browser and is a placeholder until the Microsoft 365 sign-in lands,
  at which point it should be replaced by the signed-in account.
- SIGNING IN NOW SETS IT (2026-08-18), so in practice the dropdown is a correction, not the
  way it gets chosen: the interim username sign-in above writes the signed-in person here, on
  sign-in and on every reload of that session.
- The chip in the top right reads the same identity. It used to say "Sample User — Preview
  mode", left over from when the page shipped invented sample records; it now shows whoever
  signed in, with their username underneath, and "Not signed in" when nobody has. A name in
  the corner of a dashboard reads as though somebody is signed in, so it should not show one
  when nobody is.
- Three sources, in order of how much the page actually knows: getUser() on the DataProvider
  seam, then the gate sign-in, then this dropdown. A GraphProvider returns the real account at
  getUser() and the two below it stop being reached.

The sharing limit — read this before rolling the task list out to the team:
- Ticks and edits are saved in the browser, not to the file. Two people on two machines will
  see two different lists until someone clicks "Download tasks-data.json" and puts it back in
  the site folder.
- This matters more here than in the CRM. A task list is the one thing everyone is meant to be
  looking at together, and one that quietly disagrees with itself is worse than no task list at
  all. The page says so above the list rather than leaving it to be discovered.
- If the team is going to rely on this daily, it needs a real backend — the same piece of work
  that would give the CRM shared state. Until then, treat the file as the source of truth and
  re-export after a working session.

Telling the assignee — email on a new task, added 2026-08-19:
- A task list only works if the person named on it finds out. When a task is created with
  somebody assigned, one email goes to that person: what the task is, when it is due, the
  priority, what it relates to, who assigned it, and a link back to the list.
- It fires from BOTH places a task can come into being — the Add button and the agent's
  task.add, after Apply. A task the agent wrote is still a task somebody has been given.
- It does NOT fire when: nobody is assigned; you assigned it to yourself (you already know);
  the assignee is a free-hand name with no address on the roster (inventing one would be
  worse than staying quiet); or the switch under the Add form is off. The switch is on by
  default and remembered per browser, next to a line saying which of the two routes below
  the email will take — "opens a draft you press send on" and "sends it" are different
  promises and the person adding the task should know which one they are making.
- Changing the assignee on an EXISTING task does not email anybody. Creation only, which is
  what was asked for. If reassignment should notify too, it is one more announce() call in
  saveTaskEdits.

Where the address comes from:
- The roster in tasks-data.json now carries an "email" per person. A file written before that
  field existed still works: personEmail falls back to GATE_USERS, the sign-in list, because
  the ids on the two lists are deliberately the same four (dw / ce / ee / jb). The addresses
  are the same ones already sitting in GATE_USERS, so repeating them in TASKS_FALLBACK
  publishes nothing that was not already in this repository.

Two routes, and which one runs depends on what is deployed:
- /api/notify IS DEPLOYED — the email is sent from the firm's address the moment the task is
  added. Nobody presses anything.
- NOTHING DEPLOYED — a pre-written draft opens in the sender's own mail client, addressed and
  filled in, and THEY press send. Same approach the public contact form takes, and the same
  caveat: somebody on webmail with no default mail handler sees nothing happen, which is why
  the toast names the recipient either way.
- The second is not a broken version of the first. It is what a page with no server behind it
  can honestly do, and it upgrades on its own the day the function is deployed. The page
  probes GET /api/notify once per browser session, the same way it probes /api/agent.

Deploying /api/notify (Vercel):
- Set RESEND_API_KEY, and NOTIFY_FROM to a verified sender such as
  "Modillion Dashboard <dashboard@modillionpartners.com>". Optionally NOTIFY_ALLOWED_ORIGIN,
  the same fence /api/agent has.
- Sending FROM @modillionpartners.com needs the domain verified with Resend first — three DNS
  records. Until that is done the only usable sender is Resend's own onboarding@resend.dev,
  which delivers to the account owner's address and nowhere else. Do that step before rolling
  this out, or the team gets mail from a stranger's domain.
- No key set is a supported state, not a broken one: GET returns 503, the probe fails, and the
  page keeps opening drafts.
- WHO IT WILL SEND TO. The endpoint is public — anything on the internet can POST to it, and
  left open it would be a free spam relay wearing the firm's return address. The recipient is
  checked before anything is sent: NOTIFY_ALLOWED_DOMAIN (one domain, default
  modillionpartners.com) plus an optional NOTIFY_ALLOWED_RECIPIENTS list of exact addresses.
  Anything matching neither is refused with 403. Widen it only as far as the roster needs.
- There is no queue and no retry. A send that fails says so in the toast and falls back to
  opening a draft, so the assignee is never left silently un-told. A failed email never stops
  the task being added — the task is saved and on screen before the email is attempted.

Tested 2026-08-19:
- Against a local stub standing in for the deployed function: signed in as David Wolfson,
  added "Confirm the Q2 investor report figures with the auditor by Friday, John, high". The
  reader picked out John, 2026-08-21 and High; the page POSTed to jbrosens@modillionpartners.com
  with the right task fields and "Assigned by: David Wolfson".
- The three quiet cases were checked and all three stayed quiet: assigned to yourself,
  unassigned, and the switch off. No email was sent to anybody but John.
- What has NOT been exercised: api/notify.js itself against the live Resend API. That needs
  the key and the verified domain above. The test above proves the page's half of it.


"Related to" now reaches operators too — 2026-08-19:
- A task could hang off a deal or an investor. It can now hang off an OPERATOR as well, which
  is the third thing the firm keeps records about and the one most tasks are actually about:
  chasing a budget, a reforecast, a site visit write-up.
- The picker now SAYS WHICH IS WHICH. Every option is labelled "— deal", "— deal, no folder
  yet", "— investor" or "— operator", because three lists in one flat datalist meant a bare
  name did not tell you whether you were relating a task to the sponsor or to the building
  they run.
- The one-line reader picks operators up too, after deals and investors, in that order: a deal
  is one building, an investor is a firm, an operator is a firm whose name usually turns up in
  a sentence that is really about one of its deals. Operator matching is WHOLE-NAME ONLY —
  short names like "Arden" would fire on half the sentences typed here otherwise, and a wrong
  link is worse than no link.
- "Add operator" joins "Add investor" and "Add deal" under the field, and creates the record
  with nothing but a name, same as the investor shortcut.
- NAMES ARE NOW EXCLUSIVE ACROSS ALL THREE. A name already taken by a deal folder, a pending
  deal, an investor or an operator is refused by all three shortcuts, each with its own
  message. This is new for deals, which previously only checked investors. The reason is
  below: "Related to" holds a NAME, so two records sharing one would both claim the same task
  and neither would be wrong.

Tasks on a record (Investor CRM, Operator CRM, Deal Pipeline) — added 2026-08-19:
- "What is still outstanding on this?" gets asked of one deal, one investor or one operator
  far more often than it gets asked of the whole list. It used to mean leaving the record,
  changing tab and searching the name. There is now a Tasks panel on all three, built once by
  recordTaskPanel().
- Where it sits: on an investor, between Interests and Conversations; on an operator, under
  Deals; on the Deal Pipeline, above the file table when you are one level into an area — the
  deal folder itself. Asset Management gets it on the same rule, since a property is the same
  shape of thing.
- ONE LEVEL ONLY. Deeper than that is a subfolder of the same deal, and repeating the panel
  down every level would be noise rather than an answer.
- What counts as related: the task's "Related to" against the record's NAME, case-insensitive.
  That is all that field holds, which is what forces the exclusive-names rule above.
- OPEN TASKS ONLY. The count of closed ones is in the heading ("2 open · 5 done") and
  "See all in the task list" carries the name across, where the status filter can show them.
  A record page answers what is left to do; the archive of what was done belongs on the list.
- The rows are the task list's own rows, so a task looks the same wherever it is read. The
  tick box works from here, and ticking one redraws the record you are looking at rather than
  the list hiding behind it. Clicking a title crosses to the Task List with that task's editor
  already open.
- "Add a task for X" crosses the other way: Task List, Related to already filled in, cursor in
  the box.

Known limits, deliberate:
- A DEAL WITH NO FOLDER YET has nowhere to show its panel — the pipeline says there is nothing
  to open rather than opening an empty folder, which is the right answer for documents and
  means the tasks against it are only visible on the Task List. Worth revisiting if pending
  deals start carrying real work.
- An operator's panel shows tasks linked to the OPERATOR, not tasks linked to the deals they
  run. Rolling those up would be useful and is a one-line change to tasksForName, but it would
  also mean a task appearing on a record nobody linked it to, so it is left explicit.
- The chat agent still reads deal folders, so it does not know about tasks by record either.
  Same small addition as the pending-deal gap above.

Tested 2026-08-19:
- A task linked to Acuspis (operator), one to Bonaccord Capital Partners (investor) and one to
  Hillridge - Programmatic (deal folder) each appeared on the right record and nowhere else.
- The panel does not appear one level deeper (inside "Term Sheet"), as intended.
- Ticking a task off from the operator record redrew that record in place: "1 open" became
  "0 open · 1 done".
- Clicking a title crossed to the Task List with the editor open on that task; "See all"
  crossed with the search set to the name; "Add a task for X" crossed with Related to filled.
- All six name-collision guards fired with their own message, and a genuinely new name created
  the operator and joined the picker.


The agent (the chat in the corner) — added 2026-08-17:
- One conversation, available on every tab. It sits outside the tab containers on purpose:
  the same thread follows you from the Deal Pipeline to the two CRMs to Asset Management to the
  Task List, and it knows which tab you are on when you ask. The transcript is kept in localStorage, per browser, and "New" clears it.
- The difference from the "Tell the agent" box on the CRM tab: that box reads one message and
  forgets it. This one holds context, asks when it is unsure which record you mean, and can change
  things that are ALREADY SAVED — a logged meeting, a task, an investor field, a deal's status.
  Both are kept because they are good at different things; the box gives you a full editable
  draft form and is what teaches aliases, the chat gives you a back-and-forth.
- NOTHING IS WRITTEN WITHOUT CONFIRMATION. Every change appears as a before → after line with a
  checkbox and waits for Apply — the same gate the CRM diff uses. That holds for the model too:
  a remote answer proposes, it does not commit. Proposing a change that would change nothing is
  suppressed, and when a newer proposal arrives the older one is marked superseded so an out-of-
  date diff left in the scrollback cannot be applied over a later correction.
- What it handles:
    "edit the Bronson Point meeting"      finds the log entry, shows it, asks what to change
    "change the date to the 14th, who was on it: JB and DW, next step is send the model"
                                          three fields off one sentence, on the entry in hand
    "delete that call"                    withdraws the entry (the record keeps its history)
    "mark the DDQ task done"              status, due date, assignee, priority, title, notes
    "push it to Friday and give it to Dana"
    "add a task to send the DDQ by Friday, high"
    "set North Quay's owner to JB"        investor fields, deal interest, archive/restore
    "that deal fell through"              deal status — recorded here, OneDrive untouched
    "what's overdue" / "what's due this week"
    "when did we last speak to them"
    "where are the term sheets for the Mill"
    a paragraph describing a conversation → a drafted log entry
- Ambiguity is a question, not a guess. Two conversations fit "the Mill meeting"? It lists them
  and waits. Same for tasks. Answer with the number or click the option.
- Logging a conversation from the chat also shows the knock-on changes as their own diff lines —
  the deal interest it would add, the stage it would move from Prospect. The CRM form does those
  silently on save; doing that here would be a change nobody saw.
- Document questions are answered against the whole folder trail, not just file names, because
  the deal a document belongs to lives in its path. Naming a deal scopes the search to that
  deal's folder: "term sheets for the Mill" looks inside the Mill and, if there is no term sheet
  there, says so and lists what is there instead of returning every term sheet in the firm.

Putting Claude behind the chat (api/agent.js):
- The page probes GET /api/agent once per browser session. If it answers, the panel header
  switches from "In-page" to "Claude" and messages go there. If it does not — the normal state
  for a plain static deployment — the in-page engine answers and nothing breaks. The probe result
  is cached in sessionStorage, so a static deploy logs one 404 per tab rather than one per page
  load; a newly deployed function is picked up by the next new tab.
- api/agent.js is a Vercel-style serverless function and is THE ONLY THING THAT HOLDS THE KEY.
  It never reaches the data: the browser posts a compact snapshot of the three datasets with the
  message, and the function returns a reply plus proposed actions, which the page validates
  against the live records and puts behind the same Apply button.
- To deploy: npm install, set ANTHROPIC_API_KEY in the project's environment variables,
  optionally set AGENT_ALLOWED_ORIGIN to the site's own domain, deploy. No code change here.
- Model is claude-opus-5. The action vocabulary is defined twice — as a tool schema in
  api/agent.js and as the applier in dashboard.html. If you add an operation, add it in both.
- If the endpoint errors mid-conversation the page says so in the transcript and answers with the
  in-page engine for that turn rather than dropping the message.
- SECURITY, READ THIS: once deployed the endpoint is reachable by anyone who finds the URL, and
  every call spends the key. It carries a small in-memory burst limiter and an optional origin
  check, but neither is a real control — a serverless instance is recycled and an Origin header
  is trivially forged. If the dashboard is going to live behind a real sign-in, put the same
  protection in front of this function (Vercel deployment protection, or a check against the
  Microsoft 365 token once that lands). Until then, treat the URL as the secret it is not.

Forwarding email into the CRM — REMOVED 2026-08-25:
- There was an intake address in crm-data.json and a tools/crm-ingest.py that read .eml files
  out of a folder into the CRM. Both are gone.
- WHY. Forwarding a thread to the address did nothing on its own, and it read as though it
  would: nothing ever watched that mailbox, so every message sat in Gmail until somebody
  exported it and ran the script by hand — which nobody had. The tab advertised the address
  without saying that second half out loud.
- It would also have filed the mail wrongly. The script took the sender from the outer From:
  header, which on a FORWARD is whoever forwarded it, and clean_body() stripped the inner
  From:/Sent:/To: lines as banners before anything could read them. A thread forwarded from an
  investor would have been logged against Modillion Partners, or created a record for it.
- WHAT IT WOULD TAKE TO BRING BACK. Two things, and the second is the reason it is out rather
  than fixed: teach the reader to parse the forwarded header block, and give it a mailbox that
  is actually watched — IMAP or the Gmail API on a schedule, which is a server-side job with
  credentials to keep, not something this static page can do. Until both exist, an address that
  quietly swallows mail is worse than no address.
- Conversations are logged through the agent box on the tab, or on the form that creates an
  investor. Neither pretends to be automatic.


Where the project lives, and where the dashboard reads from — 2026-08-18:
- WHICH COPY IS CANONICAL — DECIDED 2026-08-20, AND IT IS NOT THE ONE THIS PARAGRAPH USED TO
  NAME. The working copy is now:
      OneDrive-Personal/Modillion - Claude/Claude/Website Modillion
  The copy under the work drive at "David Wolfson's files - Claude/Website Modillion" is STALE
  and must not be edited. It is a byte-for-byte duplicate — .git and reflog included, both at
  264e7cd — made by dragging the folder rather than cloning, which is why the two are impossible
  to tell apart by looking. Check your path before editing; nothing in git will warn you.
- The stale copy is also what a `python3 -m http.server 8000` started from it will serve, so a
  dev server showing none of your changes is the first symptom of editing the wrong one. The
  personal copy is served on 8010 by convention, for exactly that reason.
- The older Desktop/Website Modillion copy is retired and carries a MOVED.txt saying so.
- A note on .git in a synced folder: OneDrive replicating .git while git is mid-write can corrupt
  an index. It is fine in practice, but let sync settle before and after anything heavy (rebase,
  large checkout) rather than working through it.

The document snapshot — REMOVED 2026-08-20:
- tools/onedrive-snapshot.py, tools/snapshot-source.txt and dashboard-data.json are gone.
  They read a OneDrive folder and wrote the document index the dashboard used to mirror.
  See "No documents at all" above. tools/extract-deals.py turned the last index into
  deals-data.json before the deletion; that is where the 22 deals came from.


News blast (api/blast.js) — internal, added 2026-08-25:
- Answers one question every Monday: did anybody write about us? Usually the
  answer is no, and the blast says so by not arriving.
- Watchlist lives in mentions-data.json. Eight entries in two kinds:
    ENTITY  Modillion Partners, Fairwind, and the four principals by name
    TOPIC   GP stakes in real estate; Co-GP equity & sponsor seeding
- Operators are deliberately NOT on it. Aker, Arboretum, Green Light,
  Switchback and OTH collide with unrelated companies and common words, and a
  blast that is two thirds noise stops being opened by week three. Add one
  later if it earns its place, with an anchor that pins down which firm it is.

How a hit has to prove itself:
- An ENTITY hit must arrive with the sentence from the page in which the name
  appears, quoted verbatim, and api/_news.js checks mechanically that one of
  the entry's aliases is really in it, on a word boundary. A model can talk
  itself into "close enough"; it cannot quote a name that was never on the
  page. This is why person entries list the FULL NAME only — a bare "Ernst"
  would wave through Ernst & Young on a technicality.
- A TOPIC hit has no name to anchor on, so the date is the anchor: undated, or
  older than the entry's lookback, and it is dropped rather than flagged.
- The two rules catch different failures and neither is sufficient alone. The
  quote check stops a different David Wolfson; it does NOT stop a piece about
  a modillion cornice or the Fairwind Marina, which pass the letter of it. The
  anchor text on each entry is what handles those, so keep the anchors sharp.
- Both are stricter than the Competitor Tracker, which merely flags an undated
  article. That tracker is read by somebody who went looking. This is read by
  somebody who did not.

Running:
    GET  /api/blast                 probe — what is configured, what is queued
    GET  /api/blast?op=preview      the digest as it stands, unsent
    GET  /api/blast?op=sweep        sweep the stalest entries
    GET  /api/blast?op=send         send it, mark it sent
  GET carries the verbs because Vercel Cron only issues GET. POST works too,
  with x-dashboard-key, which is what tools/blast.py uses.

    python3 tools/blast.py status | preview | sweep | send
  send asks before mailing four people unless you pass --yes, and --dry-run
  composes without sending. Seed the set once with:
    python3 tools/publish.py --only mentions

Schedule (vercel.json): three sweeps Monday 09:00, 09:30 and 10:00 UTC, then
one send at 11:00 UTC — 07:00 Eastern in summer. Three sweeps for eight
entries because a sweep is INCREMENTAL: it takes entries stalest first, files
each as it finishes, and stops starting new ones near the invocation ceiling.
A run killed mid-entry loses that entry and nothing else, and the next run
takes it first because its lastSwept is still the oldest.

Sweep and send are deliberately separate crons. A sweep is eight web-search
passes; a send is one HTTP call. Together, a slow Tuesday would mean no blast
at all rather than a blast of whatever the earlier passes did find.

Environment:
    ANTHROPIC_API_KEY      the same key /api/agent and /api/research use
    RESEND_API_KEY         the blast sends through /api/notify, not its own key
    CRON_SECRET            what Vercel Cron sends; set it, see below
    DASHBOARD_WRITE_KEY    lets a person sweep or send by hand
    BLAST_RECIPIENTS       optional, overrides recipients in mentions-data.json
    BLAST_MAX_ITEMS        optional, default 6 per entry per sweep

Unlike /api/records, THIS ENDPOINT REFUSES TO RUN UNLOCKED. With neither
CRON_SECRET nor DASHBOARD_WRITE_KEY set, sweep and send return 503. An open
write to the records store costs a bad record somebody can fix; an open blast
costs the firm's return address in four inboxes as often as a stranger asks,
and a sweep is billable model calls, so it is also a way to spend somebody
else's money. Preview stays open, matching reads elsewhere here.

An empty week sends nothing. A weekly "no mentions this week" is how people
learn to filter the sender. Use the probe or tools/blast.py status to confirm
it ran.

Caveat worth knowing before the first send: publishing REPLACES the base and
drops the deltas it accounts for, and every mention the sweep has filed lives
in those deltas. Re-seeding mentions-data.json from this folder after the
blast has been running will discard what it found. publish.py prints the
mention count in the local file for exactly this reason — a zero there is the
thing to notice before you send it, not after.


Materials and versions — what has been sent to whom (dashboard.html, Investor CRM
tab) — added 2026-09-10:
- ONE QUESTION, asked constantly and until now answered by searching somebody's
  sent items: which document did this investor get, WHICH VERSION of it, and are
  they still holding the current cut. Three pieces answer it — a register of
  materials, each with its versions; a SEND, which is one version going to one
  investor on one date; and a status pill on every send that says Current or
  Superseded.
- IT IS NOT A SIXTH RECORD SET and it is not a documents tab coming back. It
  lives inside the crm set, alongside the investors, and the register sits behind
  a "Materials" button on the Investor CRM toolbar as a third view of that tab.
  Two reasons, and the first is the one that decided it: a material is here
  BECAUSE it goes to investors — a tab of its own would invite a register of
  documents nobody has sent anybody, which is exactly what "No documents at all"
  above threw out. The second is mechanical: a send names a version, so the send
  and the version must be published together or a publish can land half of one.
- NOTHING HERE HOLDS A FILE. A version is a label, a date, a note and — if you
  have one — a link to wherever the file actually lives. The page does not read
  OneDrive, does not upload anything and cannot open a document. Same bargain
  every other record on this dashboard makes.
- NOTHING HERE SENDS ANYTHING either, and both forms say so out loud. Recording a
  send is a note that something went out; the page has no route to a mailbox.

Which version is current, decided mechanically:
- THE NEWEST DATE WINS, ties broken by the order the versions were added, so the
  later cut takes it. A version with no date sorts LAST whichever way the list is
  read and therefore cannot be current — an undated version is an absent date,
  not an early one, the same rule the deal columns follow. The add form fills
  today's date in for exactly this reason.
- Adding a version does not always make it current: an older date deliberately
  does not jump the queue. The toast says which way it landed rather than leaving
  it to be discovered from a pill somewhere else on the page.
- The status pill carries its own attribute, [data-sent], rather than borrowing
  [data-stage] or [data-overlap]. Those two are judgements somebody wrote down;
  this is a comparison of two version ids and nothing else, and the day one gets
  read as the other is the day it stops meaning anything. Where the register
  cannot answer — a hand-written send naming no version — it says Unknown rather
  than guessing either way.
- A SEND POINTS AT A VERSION ID, NEVER A LABEL. The label is the field people
  rewrite ("v3" becomes "v3 final"), and a link that follows a rename is a link
  that quietly relinks itself. The names are carried alongside anyway, as they
  read on the day it went out, so a material later renamed or retired does not
  turn its own history blank.

Registering as you go — 2026-09-10, and it REPLACES the two-step order the
paragraphs below originally described:
- IT USED TO BE A DEAD END. The panel on an investor record only drew a form when
  the register already held something; with an empty register it showed an
  explanation and a button that sent you to another view. So the first thing
  anybody met was a screen with nothing to type into — which is where "I don't
  see how to input which materials have been sent" came from, and it was a fair
  reading of what was on screen.
- Both pickers now carry a "＋ New material…" and a "＋ New version…" option, and
  choosing either opens a box beside it. Name the material, call the version,
  press Record it, and all three — material, version, send — are filed in one go.
  The form is always drawn; the empty register just says so above it.
- THE VERSION HALF IS THE COMMONER CASE and is the better reason for this. You
  have just mailed a cut nobody has written down yet. Crossing to the register,
  adding it, coming back and finding the investor again is exactly how a send
  ends up not being logged at all.
- What it creates is the SAME record the register creates, through the same two
  methods. This is a shortcut into the register, not a second and quieter way of
  keeping materials.
- A name or a version label that already exists is REUSED rather than refused.
  Somebody typing a name the register already holds means the one it holds, and
  answering that with an error would be technically right and practically
  useless. Matching is case-insensitive.
- EVERYTHING IS CHECKED BEFORE ANYTHING IS CREATED, and that ordering is the
  whole of the care in this path. The first cut of it created the material and
  then discovered the version box was empty and refused the save — which left a
  material with no versions on the SHARED register, pushed to everyone, for a
  save that never happened. A form that is refused must leave nothing behind.

Two ways in, because there are two shapes of the same act:
- ON AN INVESTOR RECORD, between the research and the tasks: every send to that
  firm, newest first, with the version and the status, and an open form to record
  another — which can register the material and the version as it goes, per the
  section above. The heading carries the count worth acting on — how many of the things
  they hold are behind. Every send is listed rather than the newest per document:
  "we sent v1 in March and v3 in July" is what explains a question about a number
  that is no longer in the deck.
- ON A MATERIAL, a tick-list of investors with what each of them currently holds
  beside their name. Pick a version, tick the people, and it files one send
  against each of their records. One document going to eleven people at once is
  the case this feature exists for, and logging it eleven times on eleven records
  is how it would stop being logged at all.
- The register's list shows, per material, the current version, how many
  investors have it and how many of those are behind. That last column is the
  whole point of the tab.

Delete, retire, withdraw — three different things:
- RETIRE is for a document that has had its day. It drops out of the send pickers
  and stays on the register, because a deck the firm has stopped sending is still
  the deck eleven investors are holding.
- DELETE is refused the moment anything has gone out from a material, and so is
  removing a version anything points at. Deleting either would leave a log saying
  an investor was sent something the register can no longer describe, which is
  worse than an unused row on a list. The refusal says to retire it instead.
  A material that has never been sent deletes on the second click, like every
  other delete here.
- WITHDRAWING A SEND is a tombstone on the log entry, not a claim that the email
  was unsent. What went out, went out; this records that the note about it was
  wrong. Same rule a withdrawn conversation follows.

How it merges, which is the reason two people can use it at once:
- A send is appended to the overlay under the investor's id and unioned BY SEND
  ID — the same arrangement conversations have had since the beginning, and for
  the same reason: two people mailing two investors on the same morning is the
  expected case, not the awkward one.
- A version goes in as a patch carrying the whole version list, unioned BY
  VERSION ID — the arrangement the Competitor Tracker's articles use. Two people
  filing two versions the same morning end with both.
- Sends and versions that arrive in a hand-written crm-data.json with no id are
  given a STABLE one derived from their own contents, so re-reading the same file
  produces the same ids and does not double anything. Same hash convId has used
  for conversations.
- Both carry the standing overlay caveat: an overlay can only ever add, so a
  version or material removed here comes back if another browser still has it
  queued. "Publish to team" is what settles it. Read "Why concurrent editing
  needs no locking" above before being surprised by that.

Where it comes out:
- crm-data.json now carries `materials` at the top level and `sends` on each
  investor. Download and "Publish to team" both include them; neither needed a
  change, because both go through toFile().
- "Export Excel" on the Investor CRM has FIVE sheets rather than the three the
  section above describes. Materials is one row PER VERSION — the question that
  workbook gets opened to answer is "which cut is current and how many people
  have it", and a material collapsed to one row cannot answer either half.
  Materials sent is one row per send, with the same Current / Superseded status
  the page shows, newest first.
- The CRM search box matches what has been sent, so "who has the GP deck" finds
  the firms from the list rather than needing the register at all.
- /api/records needed nothing. It stores two documents per set and unions the
  deltas; it still does not understand a record.

What the agent can and cannot do with it:
- The Claude-backed chat READS it: context.materials is the register with each
  material's versions and which is current, and every investor carries their
  sends with the status already computed. It can answer who is holding an old
  deck, when somebody was last sent anything, and which version went out.
- It CANNOT file one, and that is deliberate rather than unfinished. A send is a
  claim about something that happened outside this page — an email nobody here
  can see — and the two forms take four fields each. The system prompt says so,
  so it proposes going to the form rather than an action that does not exist.
- THE IN-PAGE ENGINE — the one that answers when /api/agent is not deployed —
  knows nothing about materials and will say it cannot find that rather than
  answering. Same gap the operator and competitor sets have on that engine.

Known limits, deliberate:
- "Sent" means "recorded as sent". Nothing reconciles against a real mailbox, so
  a deck mailed without being logged is a deck this page believes nobody has.
  That is the same honest limit the conversation log has always had, and the
  reason both forms are open on the record rather than behind a button.
- A version's link is a link. It is not checked, not fetched and not previewed.
- The status pill compares the version SENT against the version CURRENT. It says
  nothing about whether the investor read it, and nothing about whether the newer
  cut actually matters to them.
- There is no per-investor "should have been sent this" list, so nobody is
  flagged for never having been sent the deck at all — only for holding an old
  one. The tick-list on a material is the nearest thing: it shows "nothing yet"
  beside everyone who has not had it.

Tested 2026-09-10, in Chromium against a local server, with a seeded
crm-data.json holding two investors, one material at two versions and one
hand-written send carrying no version id:
- The register listed the material, its current version and its holders; opening
  it drew the versions newest first with the top one badged Current.
- Adding v3 dated later made it current; adding "v0 draft" dated January did NOT,
  and the toast said which one still held it. A second "V3" was refused as a
  duplicate on the label, case-insensitively.
- Ticking both investors against v3 filed one send each, on their own records.
  The holders table showed two investors, both Current; the "Every send" pile
  under it showed all three sends, the hand-written one reading Unknown because
  it names no version — which is the state that must not be guessed at.
- On the investor record: the panel listed every send, the heading counted the
  ones behind, logging v2 from the record produced a Superseded pill immediately,
  and withdrawing a send took one row out and left the rest.
- Removing a version that had gone out was refused; so was deleting the material.
  Deleting a material that had never been sent went through on the second click.
  Retire and restore both took, and the register showed the retired badge.
- Both exports built: the workbook came out with the two new sheets, and the JSON
  export carried `materials` with four versions and both sends on the investor.
- A reload with the shared store unreachable kept every version and every send —
  they are in the localStorage overlay, which is what that fallback is for.
- At 400px the tables kept their per-cell labels and the page did not scroll
  sideways.
- Registering as you go, against a register with nothing in it at all: the form
  was drawn with both boxes open, refused an unnamed material and then an unnamed
  version, and — the case that found the bug — LEFT NOTHING ON THE REGISTER after
  each refusal. One further click filed the material, the version and the send
  together, and the register then showed the material with one holder.
  Asking for a new version of a material that already existed worked from the
  same form, and the investor holding the older cut turned Superseded. A material
  name retyped in different case, with a version label the material already had,
  produced no second material and no second version.
- WHAT IS NOT COVERED: the shared store, for the same reason as everything else
  here — there is no Upstash to point at from this machine. The union merge for
  sends is the one conversations already use and the version merge is the one
  articles already use, so both are exercised paths; neither has been watched
  end to end with two browsers against a real store.

ONE DEAL, ONE LINE — the deal tabs, 2026-09-11:
- Reported from the pipeline itself: "some of them are four rows and some two",
  and it is hard to read down a list whose rows are not the same height.
- Three things were doing it. The note printed as a sub-line under the deal name;
  "why" and "debt on file" printed as sub-lines of their own; and every prose
  column wrapped. All three are gone from the row. The note and the debt flag are
  now a small NOTE / DEBT mark after the value they belong to, with the text on
  the mark's title; "why" is on the status pill's title. Every row is 52px.
- The note itself lives on the deal's record, which is what was asked for — the
  row opens it. It is still searched: a search matching only a note will surface
  the row, and the NOTE mark on it is what explains why.
- Clipping alone made the table WIDER. An auto-layout table asks each column for
  its widest value, and a column that has stopped wrapping asks for all of it:
  eleven columns wanted 1499px inside a 1128px workspace, where wrapping had cost
  89px of sideways scroll. So the deal tables are table-layout:fixed with the
  columns given shares of the workspace — they add to 100 and they have to. The
  sheet now fits with NO horizontal scroll at all, which it did not before.
- What it costs is long deal names: about 190px, so "Switchback – Casa Hope
  (Williamsburg, NY)" is cut. Hover has the whole of it and so does the record.
  If that becomes the complaint, the lever is one fewer column — Added is the
  obvious candidate and would give the name column another 85px.
- Below 1100px the proportions hold and the wrap scrolls, actions pinned right as
  before. Below 760px the rows are cards and all of it is undone.

CAPITAL RAISES — a tab, added 2026-09-11:
- Asked for as an "Investment Pipeline": a deal comes off the Deal Pipeline when
  it closes, but the co-invest piece still has to be raised and tracked.
- IT IS NOT A THIRD LIST OF DEALS, and that is the whole design. Everything on
  this page joins deals BY NAME — operators, tasks, an investor's interests — so
  a deal that existed twice is a deal those references cannot resolve. Instead a
  deal carries a `raise`, and it carries it through its close: Casa Hope moves to
  Closed Deals and stays on this tab until the co-invest is away.
- On the deal: a Capital raise panel with the target, a meter, Target /
  Committed / Soft-circled / Still to raise / Close by, and the commitments as a
  table of boxes — investor, amount, how firm, when, note. Each box saves when it
  is left. The target, close-by and note are on Edit deal beside the debt block;
  the commitments are not, so setting a target does not mean scrolling past six
  investors and correcting one investor does not mean opening the whole deal.
- How firm: Soft, Hard, Funded, Passed. COMMITTED IS HARD PLUS FUNDED. A soft
  circle is counted and shown and is deliberately not in the committed figure —
  that distinction is the only reason to have the field. Passed is kept because
  "who have we already asked" is worth being able to answer.
- THE ONE PLACE ON THIS PAGE THAT DOES ARITHMETIC. Everywhere else a figure is
  printed as typed and the reading is left to the reader; here "how much is left"
  is a target minus a sum. Amounts are still stored as typed. Anything the matcher
  cannot read — "TBD", a bare "5" — is left OUT of the sum and counted, and the
  panel says in words how many. A total that has quietly dropped a commitment is
  worse than no total.
- The tab is a roll-up and is read-only on purpose: one row per raising deal from
  both areas, sorted by what is left to find, with the firm-wide total under it
  and the deal name linking back to where the editing happens. A raise whose
  committed figure has reached its target files itself under Raised, the same way
  an archived deal files itself at the foot of the pipeline.
- On an investor's record: a Commitments panel — what they are in for, across
  deals, joined by name like every other reference. Recorded on the deal, read
  here.
- Export Excel gives two sheets: Raises (target as typed, the sums as figures)
  and Commitments (every line, per deal).
- The eighth tab did not fit. A flex row that cannot fit does not wrap the row,
  it wraps the words inside every button, so all eight labels broke onto two lines
  at once. Button padding is 14px rather than 20px now, labels are nowrap, and the
  bar scrolls below 1100px rather than below 760px.
- WHAT IS NOT COVERED: the shared store, for the same reason as everything else
  here. `raise` goes through normalise() like every other field, so it publishes
  and merges the way debt does, but that has not been watched with two browsers
  against a real store.

THE TARGET MOVED TO WHERE THE RAISE IS, 2026-09-11:
- Reported the same day the tracker shipped: "let's add a target raise". The
  field already existed. Nobody could find it, which is the same thing.
- It was on Edit deal, next to the debt block, on the reasoning that one form
  should say what a raise IS and the panel should keep what has happened to it.
  That reasoning does not survive contact with the page: somebody looking at a
  raise and wanting to set a target has to leave the raise, open a form that is
  mostly about something else, find three boxes at the bottom of it, and save.
  Most people conclude there is no target field.
- Target, Close by and Note are now boxes at the top of the Capital raise panel,
  in the same type as the computed figures below them, framed only on hover and
  focus. They save when they are left, like the commitment boxes do. Edit deal
  no longer carries them: two places to set one number is worse than a number in
  the wrong place.
- They sit OUTSIDE .raise-summary on purpose. The summary is repainted whenever
  a commitment changes, and a repaint would pull these boxes out from under
  somebody tabbing across them. Nothing in them changes when a commitment does.
- Target and Close by came OUT of the figure grid at the same time. They are
  what somebody set rather than what was computed, and printing them twice would
  leave two places showing one number with only one of them editable. The grid
  is now Committed, Soft-circled, Still to raise.
- Close by is typed, not a date picker, for the reason the debt block's maturity
  is: "End of Q1" is a real answer, and a date input would refuse it or silently
  blank it. Tested with exactly that.
- The Capital Raises tab had no way in. It is a roll-up, everything on it is
  edited on the deal it belongs to, and when it was empty it offered nothing at
  all to the one person it matters most to. It now carries a picker of the deals
  with no raise and a Start a raise button, which opens that deal's panel and
  puts the cursor in the target box. It CREATES NOTHING — a raise with nothing
  in it comes back from normaliseRaise() as no raise, so a button that made one
  and left it empty would look like a button that did not work. Typing the
  target is what starts it.
- The landing scroll is deferred by 80ms. switchTab() ends with a smooth scroll
  to the top of the workspace, and a smooth scroll already running animates
  straight over an instant one issued before it.
- The target placeholder reads "Set a target — $12m" rather than "$12m". A bare
  figure in the Target slot in placeholder grey is still a figure in the Target
  slot, and at a glance it reads as the target.

THE ROLL-UP WORKS NOW, 2026-09-11:
- Third report of the same thing in one day, and the pattern is worth writing
  down: every time the editing was put somewhere other than where the number is
  read, it was reported as missing. The target on Edit deal. Now the roll-up.
- The Capital Raises tab was read-only by design — a roll-up, with the editing
  on the deal each row belongs to. Somebody looking at the line that is out of
  date should not have to cross two screens to fix it.
- Target and Close by are boxes in their own columns on the row, saving when
  they are left. Everything between them stays read-only: typing over a total is
  not an edit, it is a wish.
- The chevron opens a row onto its commitments — the SAME raiseRows() table and
  the same add form the deal's panel draws, carrying the same data attributes
  and handled by the same handlers. One commitments table in this file, not two
  that drift apart. raiseAddForm() takes an id prefix because both surfaces can
  be in the DOM at once and two <label for> pointing at one id is a label that
  clicks the wrong box.
- THE BUG THIS DESIGN HAD TO AVOID: saveRaiseTarget() read all three boxes and
  wrote all three. A row on the roll-up has Target and Close by and NO note, so
  reading the missing one as "" would have wiped the note off every deal whose
  target was corrected from this tab. It now writes only the boxes the block
  actually has, and raiseSave() keeps what is already stored for the rest.
  Tested by correcting a target from the roll-up and checking the note survived.
- Writes from the roll-up repaint the row's figures in place rather than
  rebuilding the table — the boxes are IN that row, and a rebuild mid-edit is
  what a person tabbing across them would feel as the page fighting back. Each
  table's footer is recomputed from the rows actually in it, so it always adds
  up to what is printed above it.
- A row does not move between the open table and the Raised pile mid-edit, even
  when the target just typed has already been met. It moves on the next full
  draw. A row vanishing from under the cursor is worse than a row filed in the
  wrong place for a few seconds.
- WHAT IS NOT GREAT: on a phone the roll-up scrolls sideways inside its own box
  as it always has, and an opened row's add form is as wide as the table, so it
  scrolls with it. The page itself does not move. The deal's own panel is the
  better surface on a phone and is unaffected.

WHO HAS BEEN SENT THE MEMO, 2026-09-11:
- Asked for as: when we send a deal memo and it is the same deal as a capital
  raise, click the raise and see who has received materials.
- IT WAS UNANSWERABLE, and worth saying why precisely. A send knew its investor,
  its material and its version. A material knew its name, kind and versions.
  "Investment memo" was a material KIND. Which deal any of it was about lived in
  the document's title and in somebody's head, and nothing joined the two.
- One field on each, and the chain is one hop: raise → deal name → sends filed
  against it → investors. By name, like every other cross-reference here.
- WHY BOTH AND NOT ONE. Tagging the material is right for a deal memo, which
  belongs to one deal and always will. It is wrong for the fund deck, which
  belongs to no deal and goes out in support of a particular co-invest all the
  time. So the material carries the deal it is a document FOR, the send carries
  the deal it was FOR, and the send's box is filled from the material when you
  pick one. Typing nothing is the common case.
- The prefill never writes over a hand-typed value: it fills only when the box
  is empty or still holds the last material's deal, which it remembers in
  data-filled-from. Tested by typing a deal, switching material, and checking it
  survived.
- THE FALLBACK IS WHAT MAKES IT USEFUL ON DAY ONE. Every send already on the
  register predates the field and carries no deal — and that is not "a send for
  no deal", it is a send nobody was asked about. So a send counts for a deal
  when it says so itself, OR when it says nothing and the MATERIAL says so.
  Filing one memo against one deal lights up every send of it ever recorded.
- What the raise shows: the newest thing each investor was sent for this deal,
  which cut, whether it is current, and where they are on the raise. Then the
  two lines that are actually actionable — SENT, NOT IN YET (the follow-up list)
  and IN, NEVER SENT ANYTHING FOR THIS DEAL (the gap nobody notices, because the
  money arrived and so nobody went looking).
- It is on the deal's own page and inside an opened row on the Capital Raises
  tab, from one function, because "click the raise" means either of them.
- The deal on a material is editable on the material's record — the register is
  full of documents added before the field existed and tagging them is the point.
  The batch send from a material's record takes the material's deal and offers no
  override: it files one cut against many investors at once, and a batch that was
  for two different deals is two batches.
- The agent context carries both fields now, so "who has the memo for Casa Hope"
  is answerable there too.
- WHAT IS NOT COVERED: nothing sends anything. This records what went out, as
  the whole materials feature always has.

THE DEAL BOX IS A PICKER, 2026-09-11:
- Reported within the hour of shipping: "how come I don't see any materials sent
  in connection to the Casa Hope deal?"
- Two causes, and the first is not a bug: the field was new, so nothing was
  tagged yet and there was nothing to find. The second is a bug in the design.
- IT WAS A TEXT BOX WITH A DATALIST, chosen so it would suggest without
  refusing. Wrong for this field. The whole job of the value is to match a
  deal's name EXACTLY, and a deal here is called "Switchback – Casa Hope
  (Williamsburg, NY)" — en dash, parenthetical and all. Anybody typing
  "Casa Hope" gets a value that looks right, saves cleanly and matches nothing.
  A box that accepts an answer it cannot use is worse than one that will not
  take it.
- It is a <select> now, on the material, on the add-a-material form and on the
  send form: every deal, grouped by area, archived ones marked, blank for
  general material.
- A STORED VALUE THAT MATCHES NOTHING IS KEPT AND LABELLED, never dropped.
  Records already carry hand-typed names and a deal can be renamed under one at
  any time; silently blanking it would destroy the only clue to what was meant.
  It stays selected and reads "— not a deal on the list".
- setDealSelect() exists because assigning .value to a <select> when no option
  matches does nothing AND leaves the previous selection standing — so the send
  form would have recorded a deal nobody chose. It inserts the option first.
- Existing mismatches are now visible rather than silent: the register's Deal
  column says "No deal by that name — it matches nothing", and the material's
  own heading says "matches no deal". That is how somebody finds a bad tag
  without opening every material.
- Tested by seeding a memo tagged "Casa Hope" against a deal actually called
  "Switchback – Casa Hope (Williamsburg, NY)": the register flagged it, the
  picker kept and labelled it, and choosing the real deal lit up both sends that
  were already on the register — neither of which carried a deal of its own.

A RAISE THAT IS NOT A DEAL, 2026-09-11:
- Asked for: track the raise for Modillion GP Fund I, which is not a deal and
  must not sit on the Deal Pipeline.
- A THIRD AREA, AND IT HAS NO TAB. DEAL_AREAS gains "fund-raises", labelled
  "Fund or program". The two deal tabs filter by area, so a record filed
  there appears on neither of them without a line being written to keep it out
  — see dealsInScope(). What puts it on Capital Raises is what puts anything
  there: it carries a raise.
- WHY A DEAL-SHAPED RECORD AND NOT A NEW KIND. Every join on this page goes
  through a deal's NAME: commitments, materials filed against a deal, tasks, an
  investor's interests. A separate record type would have had to re-earn all
  four and would have drifted from them. A fund raise needs everything a deal's
  raise has and nothing a deal's pipeline has, so it is a deal record filed
  somewhere the pipeline does not look.
- New fund or program, on the Capital Raises toolbar: name, target, close by,
  sponsor, note. The same three name guards the Add deal form uses, for the same
  reason — two records sharing a name would both answer to it.
- A FUND WITH NO TARGET IS NOT LOST. normaliseRaise() returns null for a raise
  with nothing in it, and a fund filed where no deal list shows it would then be
  a record with nowhere at all: created, saved, invisible. So withRaise() takes
  anything in the fund-raises area whether or not it carries a raise yet, and
  every reader of rec.raise now tolerates null. The row says "no target" and the
  target box is there to type into.
- It is READ on the pipeline's detail pane, because that pane exists and the
  record has to be readable somewhere. Two things are corrected so the page does
  not lie about it: the breadcrumb says "All raises" and goes back to this tab,
  and the tab bar underlines Capital Raises rather than Deal Pipeline
  (markTabCurrent, split out of switchTab for exactly this).
- The "Start a raise" picker skips fund records — they are already on the list,
  so offering to start one would be a second way to reach a row you can see.
- Wording followed the data: the roll-up's columns are Deal or fund / Sponsor /
  Status, the footer counts raises rather than deals, and the same two names go
  into the Excel export.
- "Where it sits" on Edit deal offers all three areas, so a fund can be moved
  onto a deal list and a deal filed as a program, both without special cases.

TAGGING SOMETHING ALREADY SENT, 2026-09-11:
- Asked for: tag previously sent materials against a capital raise, easily.
- The deal picker on "Log something sent" only ever reached NEW sends.
  Everything already on the register — which is most of it, and all of it the
  week this shipped — could be tagged only by tagging its MATERIAL, and that
  tags every send of that material at once. Right for a memo. Wrong for a deck
  that went out for one particular co-invest.
- A Deal column on the sends tables, as a picker, saved when it is left. It is
  on all three: the investor's Materials sent, the material's Who has it, and
  the Every send pile under it — one sendRows() draws them all.
- THE CELL SHOWS WHAT THE SEND COUNTS FOR, not what is typed in it. A send with
  no deal of its own still counts for its material's deal — that is what
  sendsForDeal() matches on — so the picker reads "— from the material —" with
  the inherited name greyed underneath. Choosing a deal pins the send; choosing
  the inherit option again releases it.
- The row editor gained the same field, so the deal can also be corrected
  alongside the version, date and channel rather than only on its own.
- A BUG THIS FOUND, and it was mine from the change before: dealOptionsHtml()
  grouped by two hard-coded areas, so fund raises were in no deal picker
  anywhere. The one thing anybody would want to tag a quarterly update against
  — Modillion GP Fund I — was the one thing that could not be picked. It is
  built from DEAL_AREAS now, so a fourth area cannot be forgotten the same way.
- The picker is capped at 190px. A <select> with appearance:none sizes itself
  to its WIDEST option, and the widest option is a deal name like "Switchback –
  Casa Hope (Williamsburg, NY)" — uncapped it took 304px out of a table that
  already had six columns and pushed it over the workspace.

WHAT IS RAISING COMES FIRST, 2026-09-11:
- Reported the moment the Deal column shipped: "I don't see an option to connect
  this to Modillion GP Fund I. Capital Raises should come up first."
- Two halves. The picker was grouped by AREA, so the thing anybody is tagging a
  document against — almost always the thing currently being raised for — sat
  below two groups of buildings. A quarterly update for a fund was three
  scrolls down a list of property deals.
- Every record on the Capital Raises tab is now lifted into a "Capital raises"
  group at the top of every deal picker: the sends column, the send form, the
  material's own box. Everything else follows by area underneath, and a record
  appears ONCE — raising, or filed where it lives.
- The list is still every deal. A memo can be tagged against something that is
  not raising yet, and refusing that would be worse than a long list.
- The other half is not a bug: a fund only appears in the picker once the
  record EXISTS. Capital Raises → New fund or program creates it. Nothing can
  be tagged against a raise nobody has set up.

WON DEALS COME FIRST IN THE START-A-RAISE PICKER, 2026-09-11:
- Asked for directly: "Show closed and in contract deals first before other
  deals." A raise is started for a deal the firm is committed to — it has
  closed, or it is under contract and about to. Those are a minority of the
  pipeline and they were sitting alphabetically among every live deal, so the
  two or three names anybody opens this list for were scattered down it.
- Grouped, not merely sorted: a list that has quietly reordered itself reads as
  arbitrary, and the same <optgroup>s are what every other deal picker on the
  page already uses. "Closed or in contract" first, "Everything else" under it,
  alphabetical inside each as before.
- Closed is read from BOTH signals — the closed-deals area and a "Closed"
  status — because they can disagree. A deal still filed under Active Deals
  that has been marked Closed used to show no suffix at all and sat in the
  middle of the list; it is now labelled and lifted with the rest.
- The suffix says which of the two a deal is: "(closed)" or "(in contract)".
- The list is still every deal. A raise can be started before a deal closes,
  and refusing that would be worse than a long list.

PROGRAMME → PROGRAM, 2026-09-11:
- Asked after the button was misread: "why does this say Programme?" Two
  answers. The spelling was British, consistently with the rest of this page
  (normalise, cheque, colour, recognised, Data centres). The WORD means a raise
  with no deal under it — a fund, or a programmatic line with a sponsor.
- The spelling is now American everywhere the product says it: the button, the
  form heading, the area label, the source line under the raises table, and the
  four README entries that describe them. "Programmatic" is untouched — it is
  spelled the same either way, and it is the firm's own word for those deals.
- Safe to rename because nothing keys off the LABEL. Every branch reads the
  area ID, "fund-raises" — see isFundRaise(), dealsInScope(), the start-a-raise
  filter. The label is display only.
- ONE WAY IT COMES BACK: load() does `if (base.areas) DEAL_AREAS = base.areas`,
  so an areas array in the shared store or in deals-data.json overrides these
  labels at runtime. If the button still reads "programme" after this ships,
  that is where it is coming from, not from this file.
- Left alone: api/_news.js says "programmes" twice inside model prompts, once
  meaning a conference agenda. Nothing user-visible, different sense.
