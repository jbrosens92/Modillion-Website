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

   ------------------------------------------------------------
   TWO KINDS OF MAIL, ONE SENDER

   Since 2026-08-25 this also composes the NEWS BLAST — the media
   mentions digest described in README.txt. That is a different
   email to a different rhythm, and the tempting thing was to give
   it its own endpoint.

   It does not get one, because what is worth having exactly once
   is not the compose() function, it is the ALLOW LIST. A second
   sender is a second place to get that wrong, and the failure is
   the kind nobody notices until the firm's return address is on
   something it should not be. So /api/blast imports sendDigest()
   from here rather than holding a Resend key of its own, and
   every address still goes through allowedRecipient().
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

/* ============================================================
   THE NEWS BLAST

   A digest of media mentions, grouped by what was being watched.
   Read on a phone on a Monday, so the shape is: what named us,
   then what happened on our beat, and nothing else.

   Each entity row carries THE QUOTED SENTENCE that named us. That
   is not decoration — it is the evidence api/_news.js filed the
   row on, and putting it in front of the reader is what lets them
   dismiss a wrong-Wolfson in one second instead of opening a tab.

   An empty week SENDS NOTHING. /api/blast decides that (see
   op=send); it is recorded here because it is the sort of thing
   somebody later adds a "no mentions this week" email for, and
   that email is how a blast trains people to ignore it.
   ============================================================ */
function composeDigest(digest) {
  const groups = Array.isArray(digest.groups) ? digest.groups : [];
  const total = groups.reduce((n, g) => n + ((g.items || []).length), 0);
  const period = clip(digest.period, 80);

  const subject = "Modillion news blast — " +
    (total === 1 ? "1 item" : total + " items") +
    (period ? " (" + period + ")" : "");

  const lines = [];
  const blocks = [];

  groups.forEach(function (g) {
    const items = g.items || [];
    if (!items.length) return;
    const head = clip(g.label, 120) + (g.kind === "topic" ? " — beat" : "");

    lines.push("");
    lines.push(head.toUpperCase());

    blocks.push('<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.06em;' +
      'color:#6b7280;font-weight:600;margin:28px 0 10px">' + escapeHtml(head) + "</h2>");

    items.forEach(function (it) {
      const meta = [clip(it.publication, 120), clip(it.date, 20)].filter(Boolean).join(" · ");

      lines.push("");
      lines.push("  " + clip(it.title, 300));
      if (meta) lines.push("  " + meta);
      if (it.quote) lines.push('  "' + clip(it.quote, 240) + '"');
      if (it.takeaway) lines.push("  " + clip(it.takeaway, 600));
      lines.push("  " + clip(it.url, 500));

      blocks.push(
        '<div style="margin:0 0 18px;padding:0 0 0 12px;border-left:2px solid #e5e7eb">' +
        '<a href="' + escapeHtml(it.url) + '" style="color:#1f4b73;text-decoration:none;' +
        'font-weight:600">' + escapeHtml(clip(it.title, 300)) + "</a>" +
        (meta ? '<div style="color:#6b7280;font-size:12px;margin-top:3px">' +
                escapeHtml(meta) + "</div>" : "") +
        (it.quote ? '<div style="margin-top:7px;color:#1c1f23;font-style:italic">&ldquo;' +
                escapeHtml(clip(it.quote, 240)) + "&rdquo;</div>" : "") +
        (it.takeaway ? '<div style="margin-top:6px;color:#4b5563;font-size:14px">' +
                escapeHtml(clip(it.takeaway, 600)) + "</div>" : "") +
        "</div>");
    });
  });

  const notes = (digest.notes || []).map(n => clip(n, 300)).filter(Boolean);

  const text =
    "Modillion news blast" + (period ? " — " + period : "") + "\n" +
    lines.join("\n") + "\n\n" +
    (notes.length ? "Notes:\n" + notes.map(n => "  - " + n).join("\n") + "\n\n" : "") +
    "— Found by the watchlist in mentions-data.json. Nothing here was written by hand.";

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.55;color:#1c1f23;max-width:600px">' +
    '<p style="margin:0 0 4px"><strong>Modillion news blast</strong></p>' +
    (period ? '<p style="margin:0;color:#6b7280;font-size:13px">' + escapeHtml(period) + "</p>" : "") +
    blocks.join("") +
    (notes.length
      ? '<div style="margin-top:26px;padding-top:14px;border-top:1px solid #e5e7eb;' +
        'color:#6b7280;font-size:12px"><strong>Notes</strong><ul style="margin:6px 0 0;' +
        'padding-left:18px">' + notes.map(n => "<li>" + escapeHtml(n) + "</li>").join("") +
        "</ul></div>"
      : "") +
    '<p style="color:#6b7280;font-size:12px;margin-top:22px">' +
    "Found by the watchlist in mentions-data.json. Nothing here was written by hand.</p></div>";

  return { subject, text, html };
}

/* The one call to the mail service. Both composers end up here, so
   there is one place where the firm's return address is spent. */
async function deliver(to, mail) {
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
    const err = new Error((out && out.message) || "The mail service refused it.");
    err.refused = true;
    throw err;
  }
  return { id: out.id || null, subject: mail.subject };
}

/* What /api/blast calls. It holds no key and knows no allow list;
   this is the whole of its access to the outside world. */
export async function sendDigest(to, digest) {
  if (!process.env.RESEND_API_KEY) throw new Error("No RESEND_API_KEY configured on the server.");
  if (!allowedRecipient(to)) throw new Error("Recipient not on the allowed list: " + to);
  return deliver(to, composeDigest(digest));
}

export function canSend() {
  return !!process.env.RESEND_API_KEY;
}

export { allowedRecipient };

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
    /* The blast normally arrives through sendDigest() rather than
       over HTTP. This branch exists so a digest can be sent by hand
       from a terminal when the cron has not fired — and so there is
       one shape of request, not two. */
    const mail = clip(body.kind, 20).trim() === "digest"
      ? composeDigest(body.digest || {})
      : (clip(task.title, 300).trim()
          ? compose(task, clip(body.toName, 120), clip(body.fromName, 120),
                    clip(body.dashboardUrl, 400))
          : null);

    if (!mail) {
      res.status(400).json({ error: "No task title." });
      return;
    }

    const out = await deliver(to, mail);
    res.status(200).json({ ok: true, id: out.id, to: to, subject: out.subject });
  } catch (e) {
    if (e && e.refused) {
      res.status(502).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: "Could not send the notification." });
  }
}
