// Transactional email via Resend's REST API (fetch — no npm dependency).
// Without RESEND_API_KEY the message is logged instead of sent, so local
// development works unconfigured.
const API_URL = "https://api.resend.com/emails";

const apiKey = () => process.env.RESEND_API_KEY;
const fromAddress = () => process.env.BECHDOU_FROM_EMAIL || "Bechdou <onboarding@resend.dev>";
export const appUrl = () => (process.env.BECHDOU_APP_URL || "http://localhost:4000").replace(/\/$/, "");

async function send({ to, subject, html }) {
  const key = apiKey();
  if (!key) {
    console.log(`\n[email:not-configured] to=${to}\n  subject: ${subject}\n  ${stripTags(html)}\n`);
    return { delivered: false, reason: "RESEND_API_KEY not set" };
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email:failed] ${res.status} ${detail}`);
    return { delivered: false, reason: `resend responded ${res.status}` };
  }
  return { delivered: true };
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function layout({ heading, body, ctaLabel, ctaUrl, footnote }) {
  return `
  <div style="background:#f7f2ec;padding:32px 16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#fffdfa;border-radius:16px;padding:32px;border:1px solid #ece2d6">
      <div style="font-size:20px;font-weight:700;color:#6d1330;letter-spacing:-0.02em">Bechdou</div>
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9b8b7c;margin-top:2px">Pakistan Resale</div>
      <h1 style="font-size:22px;color:#2b2119;margin:24px 0 12px">${heading}</h1>
      <p style="font-size:15px;line-height:1.6;color:#5c4f43;margin:0 0 24px">${body}</p>
      <a href="${ctaUrl}" style="display:inline-block;background:#6d1330;color:#fffdfa;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:15px">${ctaLabel}</a>
      <p style="font-size:13px;line-height:1.6;color:#9b8b7c;margin:24px 0 0">${footnote}</p>
      <p style="font-size:12px;color:#b3a496;margin:16px 0 0;word-break:break-all">Or paste this link: ${ctaUrl}</p>
    </div>
  </div>`;
}

export function sendVerificationEmail({ to, name, token }) {
  const url = `${appUrl()}/#verify-email?token=${encodeURIComponent(token)}`;
  return send({
    to,
    subject: "Verify your Bechdou email",
    html: layout({
      heading: `Welcome, ${escapeHtml(name || "there")}`,
      body: "Confirm your email address to activate your Bechdou account and start buying and selling preloved fashion.",
      ctaLabel: "Verify email",
      ctaUrl: url,
      footnote: "This link expires in 24 hours. If you didn't create a Bechdou account, you can ignore this email.",
    }),
  });
}

export function sendPasswordResetEmail({ to, name, token }) {
  const url = `${appUrl()}/#reset-password?token=${encodeURIComponent(token)}`;
  return send({
    to,
    subject: "Reset your Bechdou password",
    html: layout({
      heading: `Password reset for ${escapeHtml(name || "your account")}`,
      body: "We received a request to reset your Bechdou password. Choose a new one using the link below.",
      ctaLabel: "Reset password",
      ctaUrl: url,
      footnote: "This link expires in 1 hour and can only be used once. If you didn't request a reset, your password is unchanged and no action is needed.",
    }),
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}
