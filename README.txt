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
  from OneDrive, Graph, Dropbox, Drive or object storage. Four record sets: deals, operators,
  investors, tasks.
- Two states. It opens on a gate and switches to the dashboard once signed in.
- What it does: a deal pipeline with the operator behind each deal, where it stands and the
  debt on the ones the firm owns; two CRMs; a task list; and an agent across all of them.

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

