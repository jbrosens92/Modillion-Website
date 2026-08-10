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
