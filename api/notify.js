/* ============================================================
   /api/notify — the one thing that can send an email

   When a task is created and assigned to somebody, that person
   should hear about it without having to open the dashboard. The
   page cannot send mail: it is served publicly, so an API key in
   its source is a key anyone can spend. This function holds the
   key and is the only thing that can send.

   Same shape as /api/agent, deliberately:
     - GET is a probe. No key configured returns 503, which is a
       normal state, not a broken one — the page falls back to
       opening a pre-written draft in the sender's own mail client.
     - POST sends one notification.

   Deploying it (Vercel):
     1. Set RESEND_API_KEY in the project's environment variables
     2. Set NOTIFY_FROM to a verified sender, e.g.
        "Modillion Dashboard <dashboard@modillionpartners.com>"
     3. Optionally set NOTIFY_ALLOWED_ORIGIN to your own domain
     4. Deploy. The dashboard probes GET /api/notify on load and
        starts sending by itself.

   Sending FROM @modillionpartners.com needs the domain verified
   with Resend first (three DNS records). Until that is done the
   only usable sender is Resend's own onboarding@resend.dev, which
   will deliver to the account owner's address and nowhere else.

   WHO IT WILL SEND TO
   This endpoint is public — anything on the internet can POST to
   it. Left open it would be a free spam relay wearing the firm's
   return address, so the recipient is checked against a list
   before anything is sent:

     NOTIFY_ALLOWED_DOMAIN      one domain, default modillionpartners.com
     NOTIFY_ALLOWED_RECIPIENTS  optional comma-separated exact addresses

   An address matching neither is refused with 403. Widen it only
   as far as the team roster actually needs.
   ============================================================ */

export const maxDuration = 15;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const FROM = process.env.NOTIFY_FROM || "Modillion Dashboard <onboarding@resend.dev>";
const ALLOWED_DOMAIN = (process.env.NOTIFY_ALLOWED_DOMAIN || "modillionpartners.com").toLowerCase();
const ALLOWED_LIST = String(process.env.NOTIFY_ALLOWED_RECIPIENTS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

/* Same throttle as the agent: a small in-memory window, per instance.
   It is not a real rate limiter across a fleet of lambdas — it is
   enough to stop one loop in one browser mailing somebody forty times. */
const seen = new Map();
function throttled(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const hits = (seen.get(key) || []).filter(t => now - t < windowMs);
  hits.push(now);
  seen.set(key, hits);
  if (seen.size > 500) seen.clear();
  return hits.length > limit;
}

function clip(v, n) {
  return String(v == null ? "" : v).slice(0, n);
}

function allowedRecipient(addr) {
  const a = String(addr || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return false;
  if (ALLOWED_LIST.length && ALLOWED_LIST.indexOf(a) !== -1) return true;
  return a.endsWith("@" + ALLOWED_DOMAIN);
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* The email itself. Kept deliberately plain: a task notification is
   read on a phone in three seconds and then acted on somewhere else,
   so it says what the task is, when it is due and who asked, and
   links back to the list. No images, no tracking, no unsubscribe
   theatre — this is internal mail between four people. */
function compose(task, toName, fromName, dashboardUrl) {
  const title = clip(task.title, 300);
  const due = clip(task.due, 20);
  const priority = clip(task.priority, 20) || "Medium";
  const link = clip(task.link, 200);
  const notes = clip(task.notes, 2000);

  const subject = (priority === "High" ? "[High] " : "") +
                  "New task for you: " + title;

  const rows = [
    ["Task", title],
    ["Due", due || "No date set"],
    ["Priority", priority],
    ["Related to", link || "—"],
    ["Assigned by", fromName || "the dashboard"]
  ];
  if (notes) rows.push(["Notes", notes]);

  const text =
    (toName ? toName.split(/\s+/)[0] + "," : "Hello,") + "\n\n" +
    "A task has been assigned to you on the Modillion dashboard.\n\n" +
    rows.map(r => r[0] + ": " + r[1]).join("\n") + "\n\n" +
    (dashboardUrl ? "Open the task list: " + dashboardUrl + "\n\n" : "") +
    "— Sent automatically when the task was created.";

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.55;color:#1c1f23;max-width:560px">' +
    "<p>" + escapeHtml(toName ? toName.split(/\s+/)[0] + "," : "Hello,") + "</p>" +
    "<p>A task has been assigned to you on the Modillion dashboard.</p>" +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0">' +
    rows.map(r =>
      '<tr><td style="padding:5px 16px 5px 0;color:#6b7280;vertical-align:top;' +
      'white-space:nowrap">' + escapeHtml(r[0]) + "</td>" +
      '<td style="padding:5px 0;vertical-align:top">' + escapeHtml(r[1]) + "</td></tr>"
    ).join("") +
    "</table>" +
    (dashboardUrl
      ? '<p><a href="' + escapeHtml(dashboardUrl) + '" style="color:#1f4b73">' +
        "Open the task list</a></p>"
      : "") +
    '<p style="color:#6b7280;font-size:13px;margin-top:24px">' +
    "Sent automatically when the task was created.</p></div>";

  return { subject, text, html };
}

export default async function handler(req, res) {
  const allowed = process.env.NOTIFY_ALLOWED_ORIGIN;
  if (allowed) {
    const origin = req.headers.origin || "";
    if (origin && origin !== allowed) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", allowed);
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  // The dashboard's probe. No key is a normal state — the page falls
  // back to opening a draft in the sender's own mail client.
  if (req.method === "GET") {
    if (!process.env.RESEND_API_KEY) {
      res.status(503).json({ ok: false, error: "No RESEND_API_KEY configured." });
      return;
    }
    res.status(200).json({ ok: true, from: FROM, domain: ALLOWED_DOMAIN });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    res.status(503).json({ error: "No RESEND_API_KEY configured on the server." });
    return;
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anon";
  if (throttled(String(ip).split(",")[0].trim())) {
    res.status(429).json({ error: "Too many notifications — try again in a minute." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const to = clip(body.to, 200).trim();
    const task = body.task || {};

    if (!to) {
      res.status(400).json({ error: "No recipient." });
      return;
    }
    if (!allowedRecipient(to)) {
      res.status(403).json({ error: "That recipient is not on the allowed list." });
      return;
    }
    if (!clip(task.title, 300).trim()) {
      res.status(400).json({ error: "No task title." });
      return;
    }

    const mail = compose(task, clip(body.toName, 120), clip(body.fromName, 120),
                         clip(body.dashboardUrl, 400));

    const sent = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html
      })
    });

    const out = await sent.json().catch(() => ({}));
    if (!sent.ok) {
      res.status(502).json({ error: (out && out.message) || "The mail service refused it." });
      return;
    }

    res.status(200).json({ ok: true, id: out.id || null, to: to, subject: mail.subject });
  } catch (e) {
    res.status(500).json({ error: "Could not send the notification." });
  }
}
