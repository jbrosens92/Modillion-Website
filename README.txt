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
