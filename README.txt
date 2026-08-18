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
- NO DOCUMENT SOURCE IS CONNECTED YET. The page is a working shell: everything it displays
  comes from SampleProvider, a block of made-up placeholder content near the bottom of the
  file. A tan "Sample data" bar sits above the hero saying so. Nothing real is exposed.
- Two states. It opens on a gate ("Sign in with Microsoft", currently disabled) and switches
  to the dashboard via the "Preview with sample data" button. dashboard.html?preview=1 skips
  straight to the dashboard, which is the quickest way to review layout.
- What it does: eight category cards with document counts and last-updated stamps; click one
  to browse its folders with a breadcrumb; a sortable file table (Name / Type / Modified /
  Modified by / Size, folders always first); and search across every category at once.
- Adding or renaming a category is one object in DASHBOARD_CONFIG.categories at the top of
  the <script>. Nothing else needs editing. Icons come from the ICONS map just below it.

Connecting the real documents later:
- Everything the page displays goes through one interface — the DataProvider seam, documented
  in a comment block in the script. Four methods: getUser, getCategories, listFolder, search.
- Connecting OneDrive means writing a GraphProvider with those same four methods and changing
  the single line "var Provider = SampleProvider;". No rendering code changes.
- That work needs a Microsoft Entra ID (Azure AD) app registration from whoever administers
  the Microsoft 365 tenant: single-tenant, platform type "Single-page application", redirect
  URIs for modillionpartners.com/dashboard.html (plus www and localhost:8000 for dev),
  delegated read-only Graph permissions (User.Read, Files.Read.All, Sites.Read.All), admin
  consent granted, and "Assignment required = Yes" on the enterprise app with a staff security
  group assigned — that last setting is what actually controls who gets in.
- They return an Application (client) ID and a Directory (tenant) ID. Both are public
  identifiers that appear in the page source of every Microsoft single-page app, so they are
  safe in this repository. NO CLIENT SECRET — a public SPA must not have one, and no secret,
  key, or password should ever be committed here.
- Note on how the gating works once connected: the HTML shell stays publicly served, but it
  holds no data. Document names and links only ever arrive from Microsoft with a valid token
  belonging to a Modillion account. A password checked in JavaScript would be readable in
  view-source and is deliberately not used.

Local preview:
- MSAL redirects will not work from file://, so serve the folder over http:
    python3 -m http.server 8000
  then open http://localhost:8000/dashboard.html


The Deal Pipeline tab (dashboard.html) — renamed from "Documents" 2026-08-18:
- Same tab, same folder mirror, new name: it is the deal folders as they stand in OneDrive, so
  "Deal Pipeline" says what is on it. The internal id is still "docs" — it is wired through the
  tab switch, the print rules and the agent's context — so only the label changed.
- It now carries Active Deals and Closed Deals only. Asset Management moved to its own tab
  (below), so the tiles count the pipeline and the category count reads 2 + 8.

Investor CRM (dashboard.html, "Investor CRM" tab) — added 2026-08-17:
- Tracks investor conversations: who the investor is, what type (family office, institutional,
  endowment, GP-stakes fund, platform), check size, which deals they are interested in, the
  research on them, and a dated log of every conversation.
- Same data rule as the document snapshot. Real records live in crm-data.json, which is
  GITIGNORED and never deployed. The committed page falls back to CRM_FALLBACK, three invented
  firms, so the published dashboard shows the structure and nothing real. A line above the
  table always says which of the two is loaded.
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

Asset Management (dashboard.html, "Asset Management" tab) — split out 2026-08-18:
- Was a category card on the Documents tab; now its own tab, sitting left of the Task List. The
  pipeline is what the firm is buying, this is what it already owns, and the two get read at
  different times by different people.
- IT IS THE SAME MACHINERY, POINTED AT ONE AREA. The views are addressed by role rather than by
  id (WORKSPACE_VIEWS at the top of the script), so the Deal Pipeline and Asset Management share
  one detail view, one file table, one sort, one report builder. Adding a third document tab is
  one more row in that map plus a `ws` on the area.
- Its front page is the properties themselves, one card each with a document count and a last
  updated stamp, rather than a single category card you have to click through. Below that it is
  the same folder browsing, with breadcrumbs that read All properties / <property> / <folder> —
  the area's own name is not a step in the trail, because the tab IS the area.
- Each tab searches its own folders. One index underneath, filtered by the area a hit came from:
  a search for "mill" on the pipeline returns the closed Greenwich deal, the same search here
  returns the operating property, and neither answers a question nobody asked.
- "Asset report" is the same report builder scoped to the area, and it knows the difference: it
  counts PROPERTIES rather than deals, and it drops the coverage matrix, which asks whether a
  term sheet and an investment memo are on file — the wrong questions for something already
  owned. Export PDF and Export Excel work as they do on the pipeline.
- The print stylesheet prints whichever report is open, on either document tab. Both workspaces
  are forced visible for print and everything that is not the open report is hidden by class, so
  exactly one report reaches the page.
- Which tab an area lands on is one property in DASHBOARD_CONFIG.areas: `ws: "assets"`. Nothing
  else knows the split, including the deal tags on the Operator CRM — a tag opens whichever tab
  its area belongs to.
- Known limit, deliberate: the "By document type" cards on the pipeline still read across EVERY
  area, asset management included. They are a cross-cutting view of all documents, and the
  snapshot currently files nothing under asset management, so nothing double-counts today. If
  the properties fill up and the type cards should stop counting them, the type index needs an
  area scope — say so and it is a small change.

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

The sharing limit — read this before rolling the task list out to the team:
- Ticks and edits are saved in the browser, not to the file. Two people on two machines will
  see two different lists until someone clicks "Download tasks-data.json" and puts it back in
  the site folder.
- This matters more here than in the CRM. A task list is the one thing everyone is meant to be
  looking at together, and one that quietly disagrees with itself is worse than no task list at
  all. The page says so above the list rather than leaving it to be discovered.
- If the team is going to rely on this daily, it needs a real backend — the same piece of work
  that would give the CRM shared state and the mailbox an automatic intake. Until then, treat
  the file as the source of truth and re-export after a working session.

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

Forwarding email into the CRM:
- Intake address is set in crm-data.json under "intake" (not repeated here — it is a personal
  mailbox). It is currently a Gmail plus-address, which works with no setup: mail sent to
  <account>+crm@gmail.com lands in the same inbox and a filter can label it "CRM". Swap it for a
  shared crm@modillionpartners.com alias when the team wants an address that is not personal.
- Forward the thread, save the messages as .eml into crm-inbox/ (gitignored), then:
      python3 tools/crm-ingest.py crm-inbox/ --dry-run     # show what it would do
      python3 tools/crm-ingest.py crm-inbox/ --archive crm-inbox/done
  It matches each message to an investor by the sender's address, then the firm name in the
  text, then the sender's domain; creates a record when the firm is genuinely new; saves the
  sender as a contact so the next thread matches on the address; and deduplicates on Message-ID,
  so running it twice over the same folder logs nothing twice.
- Run --dry-run first. The script writes crm-data.json directly, with no review step, and its
  stage and check-size reads are the same guesses the dashboard makes.
- What is NOT built: an always-on mailbox that ingests by itself. That needs a real mailbox plus
  a scheduled fetch (IMAP or the Gmail API) — a small addition, but a server-side one, and it
  cannot live in this static page.


Where the project lives, and where the dashboard reads from — 2026-08-18:
- The project moved into OneDrive. It now lives under "David Wolfson's files - Claude", so it
  syncs and is shared rather than sitting on one desktop. The old Desktop/Website Modillion copy
  is retired; it carries a MOVED.txt saying so. Do not edit it — two git working copies of the
  same repo diverge quietly, and this one is canonical.
- A note on .git in a synced folder: OneDrive replicating .git while git is mid-write can corrupt
  an index. It is fine in practice, but let sync settle before and after anything heavy (rebase,
  large checkout) rather than working through it.

The document snapshot, in one place:
- The Deal Pipeline and Asset Management tabs mirror a real OneDrive folder. dashboard-data.json
  is not maintained by hand — tools/onedrive-snapshot.py reads the folder and writes it.
- Which folder that is used to be a command-line argument nobody wrote down, which made "the
  dashboard is stale" and "the dashboard is pointed somewhere else" impossible to tell apart.
  It is now recorded in tools/snapshot-source.txt: the path, then "only:" lines naming the
  top-level folders allowed to become areas. That file is gitignored — a local machine path,
  and this repository is public.
- Refresh the dashboard after the folders change:
      python3 tools/onedrive-snapshot.py                  # the recorded source
      python3 tools/onedrive-snapshot.py "/other/folder"  # override for one run
      python3 tools/onedrive-snapshot.py --all-areas      # ignore the only: list
- THE only: LIST MATTERS. The source folder holds much more than the dashboard shows — Pitchbook,
  Dead Deals, Entity Docs, Capital Calls and the rest. Areas the config does not declare never
  appear as tiles, but buildTypeIndex() reads across EVERY area in the file, so without the list
  the "By document type" cards quietly count dead deals and pitchbook drafts as live term sheets
  and models. Scanning the whole folder gives 13 areas and 1194 files; the three declared ones
  give 23 deals and 952. Keep the list in step with DASHBOARD_CONFIG.areas in dashboard.html.
- Only names, sizes and timestamps are read; file contents are never opened. The output holds
  real deal and sponsor names and is gitignored — it must never be committed.
