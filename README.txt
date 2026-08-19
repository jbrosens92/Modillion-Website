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
  belonging to a Modillion account. That is what makes it real access control, and it is why
  the interim sign-in below is not.


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
- WHEN THE MICROSOFT 365 SIGN-IN LANDS, DELETE ALL OF THIS. GATE_USERS, the gate form and the
  session keys go; getUser() on the DataProvider seam starts carrying the real account and the
  chip uses it as-is. Do not keep this as a fallback — a second way in that is weaker than the
  first is just the weaker one.

Local preview:
- MSAL redirects will not work from file://, so serve the folder over http:
    python3 -m http.server 8000
  then open http://localhost:8000/dashboard.html


The Deal Pipeline tab (dashboard.html) — renamed from "Documents" 2026-08-18:
- Same tab, same folder mirror, new name: it is the deal folders as they stand in OneDrive, so
  "Deal Pipeline" says what is on it. The internal id is still "docs" — it is wired through the
  tab switch, the print rules and the agent's context — so only the label changed.
- It now carries Active Deals and Closed Deals only. Asset Management moved to its own tab
  (below).
- The four summary tiles across the top — Documents indexed, Categories, Most recently updated,
  Document source — were removed 2026-08-18, from this tab and from Asset Management. They
  restated what the cards underneath already say, and read as a row of dashes whenever no
  document source was connected, which is the published state. The "Last synced" line stays on
  the toolbar.

"Add deal", on the Deal Pipeline toolbar — added 2026-08-18:
- What it does NOT do first, because it is the whole shape of the thing: it does not create the
  OneDrive folder. This page mirrors that folder and cannot write to it, and nothing here should
  be able to reach into it. A deal added with this button is a NAME the firm is working on,
  held in the same local overlay as every other edit on the page.
- Where it shows: at the top of Active Deals or Closed Deals, whichever the form was set to,
  sitting with the folders it will one day join and marked "No folder yet". It carries the
  operator, a note and the date it was added instead of a modified stamp and a size, and clicking
  it says there is nothing to open rather than opening an empty folder. The area card says
  "N awaiting a folder" beside the document count, and a search on the tab finds it — a page
  that let you add a deal and then answered "no results" for its name would be disagreeing
  with itself.
- The fields are name, area, status, operator and a note. Status writes the same CRM-side deal
  status the Investor CRM sets, so marking it On hold or Dead here strikes it through everywhere
  it appears. An operator already on the Operator CRM picks the deal up on their record, using
  the record's own spelling rather than what was typed; a name that is not on that CRM is kept
  on the deal and no operator record is invented.
- IT IS THE SAME LIST the CRM's "add as a deal" offer writes to (dealsAdded in crm-data.json),
  so a deal added on either side is one deal. It joins the deal pickers on both CRMs and the
  task list straight away. That list used to hold bare names and now holds records — name, area,
  operator, note, date. Old files holding plain strings still read, as Active Deals with the
  rest blank.
- Names are checked three ways before anything is saved: one that is already a OneDrive folder,
  one already on this list, and one that is an investor on the CRM each get their own message
  and nothing is written. Matching is case-insensitive.
- Remove takes two clicks (the button arms itself and says so). This one genuinely removes,
  where archiving an investor does not: a name with no folder carries no documents and no
  conversation history, so there is nothing behind it to lose. What the name touched elsewhere
  — a deal status, an investor's interest, an operator's deal list — is left exactly as it was.
- When somebody creates the folder for real, the next snapshot brings it in and the pending row
  drops out on its own: the folder is the better answer to the same name. Nothing has to be
  tidied up by hand, which is why the form says to name it the way the folder will be named.
- Saved in the browser like every other edit here. "Download crm-data.json" on the Investor CRM
  tab writes it back to the file — same sharing limit as the rest of the page.
- Known limits, deliberate: the reports count documents and folders, so a deal with neither does
  not appear in them; and the chat agent reads deal FOLDERS, so it does not yet know about a deal
  added here. Both are small additions if they start to matter.

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
- Superseded 2026-08-19 — the type cards now skip asset management. The note below is what
  used to be here, kept because it is the reasoning that got acted on:
    "Known limit, deliberate: the 'By document type' cards on the pipeline still read across
    EVERY area, asset management included. They are a cross-cutting view of all documents, and
    the snapshot currently files nothing under asset management, so nothing double-counts
    today. If the properties fill up and the type cards should stop counting them, the type
    index needs an area scope — say so and it is a small change."
  The properties filled up, so the scope went in. Not by skipping the area while indexing —
  that was the first attempt and it silently emptied the Asset report's own "by document type"
  table, which has every right to those documents. The index still reads EVERY area; each hit
  now carries the areaId it came from, and the SCOPE IS APPLIED WHERE DOCUMENTS ARE COUNTED:
  hitsFor(catId, ws) in the provider, and one `ws` per report in buildReport().
  Unscoped, the pipeline cards read financials 41 instead of 32, investor updates 23 instead of
  13 and sponsor materials 43 instead of 35 — the same rent rolls and update letters counted
  once as deal documents and again as property documents. The asset side is the complement:
  9, 10 and 8. The two add up, which is the check that the split is clean.
- The portfolio report had the same fault and it is fixed the same way. An unscoped report used
  to mean "every area", which was right while each tab was one folder; it would now have listed
  all three properties a second time as deals. A report belongs to one tab.


Where Asset Management gets its properties — rebuilt 2026-08-19:
- IT HAS NO FOLDER OF ITS OWN ANY MORE. It used to be a top-level "Asset Management" folder in
  the Fund I library, one folder per property; it held a single half-built entry (Mill,
  Greenwich CT, with an empty Monthly Update Letters inside) and has since been removed. Running
  the snapshot against the source as it stands printed "recorded area not found in source:
  Asset Management" and wrote a two-area file — the tab would have gone empty.
- What replaced it is a better convention: what the firm owns is filed inside the deal folder it
  closed under. The Arden — reorganised into 1. OM … 6. Asset Management — is the model.
- So the area is DERIVED. tools/snapshot-source.txt gained an "assets-from:" line naming the area
  to read it out of (_Closed Deals), and the script builds one property per closed deal that has
  asset-management material, carrying that material ONLY, not the whole deal folder.
- Which subfolders count: one named "Asset Management", or one the financials / investor-updates
  crosscut groups already match. That is what lets the older deals in — they predate the naming
  and file the same material under its parts. Today: The Arden 21 documents, The Mill 17
  (Investor Letters, Quarterly Financials, Financial Statements, Depreciation, Percentage
  Ownership), Gainesville 1 (Quarterly Updates).
- A folder named "Asset Management" is SPLICED OPEN rather than shown as a step — the tab is
  asset management, so a breadcrumb reading All properties / The Arden / 6. Asset Management is
  saying it twice. The Arden opens straight onto Financials, Sponsor Updates and its update
  workbook. Same reasoning as the area's own name not being a step in the trail.
- It is a VIEW, not a second copy. Its files live in the closed-deal folders and appear on the
  Deal Pipeline too, which is the point — the same document read at different times by different
  people. Two consequences, both deliberate: totalFiles counts the source areas only (958, not
  997), and the type cards skip the area, as above.
- --no-assets skips the derivation for one run.
- If a top-level Asset Management folder ever comes back, this becomes one line: drop the
  assets-from: line and add "only: Asset Management" again. Nothing in dashboard.html knows the
  difference — the area arrives with the same id and label either way.

The debt report (Asset Management tab) — added 2026-08-19:
- "Debt report" on the Asset Management toolbar, beside "Asset report". One row per asset with
  lender, committed and current balance, rate type, index and spread, cap, floor, maturity and
  extension options — what the firm owes across everything it owns, on one page. Export PDF and
  Export Excel work as they do on the other reports.
- THIS IS THE ONE PLACE THE DASHBOARD READS A DOCUMENT'S CONTENTS. Everywhere else the rule is
  names, sizes and timestamps only, and it still holds. A debt report cannot be assembled from a
  file name, so tools/onedrive-snapshot.py opens exactly one workbook — the one named on the
  "debt-from:" line in snapshot-source.txt — and nothing else. Read the comment above
  fmt_debt_cell() in that file before extending this; the narrowness is the point.
- What that costs: dashboard-data.json now carries lenders, balances and rates as well as deal
  names. It was already gitignored and never deployed. It is more confidential than it was.
- The workbook drives the report, not the other way round. Columns come from its header row, so
  adding a column in Excel adds a column here with no code change. The newest .xlsx/.xlsm in the
  folder wins. The header is found as the first row with more than one label, because the sheet
  opens with a blank row today and could gain a title row tomorrow.
- Cells are formatted by the snapshot, from each cell's own number format: a $#,##0 cell prints
  with a dollar sign and thousands separators, an 0.00% cell prints as a percentage to two
  places, a date prints as "Mon D, YYYY". The report prints the workbook the way the workbook
  prints itself, and the browser does no arithmetic on any of it.
- An asset with nothing filled past the Lender column reads "No debt recorded" rather than a row
  of dashes — The Mill today. The summary tiles count assets, with debt, and unlevered.
- It never appears in an anonymised snapshot. Pseudonyms exist so a snapshot can be shown to
  somebody, and a real lender and balance would walk straight through them, so --anonymise skips
  the workbook and says so. --no-debt skips it for one run.
- The button hides itself when the snapshot carried no workbook, which is the published page's
  state — better than a button that opens an empty report.
- It needs openpyxl (pip3 install openpyxl). Missing, the snapshot prints a NOTE and writes
  everything else; the tab simply has no Debt report button.
- The roll-up and the folders are joined by name — see below.

Joining the debt roll-up to the property folders — added 2026-08-19:
- The two records of the same building are typed by different people for different purposes and
  agree on the words, not the formatting: the workbook says "The Mill", the folder says "The Mill
  - Greenwich, CT". join_debt() in onedrive-snapshot.py matches them and writes the link both
  ways — the property gets `debtRow`, the roll-up gets `match`.
- Matching is tried strongest first, because a wrong join is worse than no join: a loan shown
  against the wrong building is a number somebody acts on. In order — the whole name or the name
  with its location trimmed; one name opening the other; then every word of one appearing in the
  other, and only if that picks out exactly ONE property. Case, punctuation and a leading "the"
  are ignored throughout. "Mill", "the mill", "The Mill, Greenwich" and "The Mill - Greenwich,
  CT" all land on the same folder; "Some Other Asset" lands on nothing.
- Nothing is dropped quietly. A roll-up row with no folder, and a property with no roll-up row,
  each print a NOTE on the run, as does the count joined ("joined to properties: 3 of 3").
- Where the join shows:
    · the property CARD carries lender, current balance and maturity, above the document counts,
      because it is the fact somebody came to the tab for;
    · the property DETAIL view carries the full row — every column the workbook has — on the
      property itself and not on the folders inside it, the same rule the task panel follows;
    · the asset name in the Debt report is a BUTTON back to the folder. The join is only worth
      making if it is walkable in both directions.
- All three read the row by COLUMN ROLE (/lender/i, /balance/i, /maturity/i) rather than by
  position, so reordering columns in Excel cannot start showing a rate cap where a lender was.
- A property in the roll-up with nothing past the Lender column reads "No debt recorded" rather
  than blanks — The Mill today. A property with no row at all shows no debt line, which is a
  different statement and deliberately looks different.
- The workbook itself was corrected on 2026-08-19: it spelled Greenwich "Greenich". Fixed in the
  file rather than papered over in the report, by replacing the one string in sharedStrings.xml
  and copying every other part of the .xlsx through untouched — the file carries webextension
  parts that a rewrite through a spreadsheet library would have dropped.

Reading a PDF without leaving the page — added 2026-08-18:
- Click a PDF anywhere in a file table and it opens in a preview panel over the page rather than
  in a new tab. Built for Asset Management, where the documents are things you read — monthly
  update letters, quarterly financials, property reports — but it is on the shared file table, so
  the Deal Pipeline gets it too. Close with the button, the Escape key, or a click outside.
- "Open in new tab" is on the panel and goes to the file's SharePoint page, not the preview link:
  that page is where version history, comments and the rest of the SharePoint chrome live, and
  the frame does not carry any of it.
- IT NEEDS A PREVIEW LINK AND THERE IS NOT ONE YET. The item shape gained an optional previewUrl
  (see the DATA PROVIDER SEAM comment in dashboard.html). Nothing sets it today: the snapshot
  tool records names, sizes and timestamps only, and never file contents or links. So no PDF
  previews today — every file still opens the way it did.
- What makes it work is the GraphProvider, whenever that lands. previewUrl must be Graph's
  "@microsoft.graph.downloadUrl" on the driveItem — a short-lived, pre-authenticated link to the
  file's bytes, which a browser will render inside a frame. It must NOT be webUrl: that is
  SharePoint's own page for the file and SharePoint refuses to be framed, so the panel would
  come up blank. webUrl stays where it already is, on `url`, driving "Open in new tab".
- Only PDFs preview. Word and Excel files have no in-browser renderer to point a frame at, so
  they open in a new tab as before, and so does a PDF that arrives without a previewUrl. The
  fallback is the old behaviour rather than an error.

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
  that would give the CRM shared state and the mailbox an automatic intake. Until then, treat
  the file as the source of truth and re-export after a working session.

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
  top-level folders allowed to become areas, then the "assets-from:" line that says where the
  Asset Management area is read out of. That file is gitignored — a local machine path, and this
  repository is public.
- Refresh the dashboard after the folders change:
      python3 tools/onedrive-snapshot.py                  # the recorded source
      python3 tools/onedrive-snapshot.py "/other/folder"  # override for one run
      python3 tools/onedrive-snapshot.py --all-areas      # ignore the only: list
      python3 tools/onedrive-snapshot.py --no-assets      # skip the derived asset area
      python3 tools/onedrive-snapshot.py --no-debt        # skip the debt roll-up
- THE only: LIST MATTERS. The source folder holds much more than the dashboard shows — Pitchbook,
  Dead Deals, Entity Docs, Capital Calls and the rest. Areas the config does not declare never
  appear as tiles, but buildTypeIndex() reads across EVERY area in the file, so without the list
  the "By document type" cards quietly count dead deals and pitchbook drafts as live term sheets
  and models. Scanning the whole folder gives 13 areas and 1194 files; the two
  declared ones give 22 deals and 958. Keep the list in step with DASHBOARD_CONFIG.areas in
  dashboard.html — allowing for asset management, which is declared there but derived here.
- The run prints what it did, and the NOTE lines are worth reading: a recorded area that is not
  in the source, or an assets-from area that produced nothing, both say so rather than quietly
  writing a short file.
- Only names, sizes and timestamps are read, with ONE exception: the debt roll-up workbook named
  on the "debt-from:" line, whose rows become the Debt report (see above). No other file is
  opened. The output holds real deal and sponsor names, and now lenders and loan balances too. It
  is gitignored — it must never be committed.
