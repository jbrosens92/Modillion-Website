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
- Sort on any column; filter by type, stage or deal interest; search runs across names,
  mandates, research notes and conversation text at once.
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
  everywhere it appears, including the deal rows on the Documents tab, and drops it out of
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
  To put a real model behind it, keep Reader.read(text) and swap its body for a fetch to a small
  server-side function that holds the key — the comment block above Reader in dashboard.html has
  the shape. Nothing else in the page changes; the draft form is the same either way.
- Known rough edge: stage is the weakest guess. A message saying "I'll revert with our diligence
  list" reads as "In diligence" when it is really still an intro. Correct it in the draft.

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
