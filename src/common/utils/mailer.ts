import nodemailer from 'nodemailer';
import { env } from '../../config/env';

function createTransport() {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        // Gmail App Passwords work with or without spaces
        pass: env.SMTP_PASS.replace(/\s/g, ''),
      },
    });
  }
  return null;
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!transport) transport = createTransport();
  return transport;
}

export type MailAction = { url: string; label: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(subject: string, body: string, action?: MailAction): string {
  const lines = body
    .split('\n')
    .map((l) => `<p style="margin:0 0 10px 0;color:#374151;line-height:1.6">${escapeHtml(l)}</p>`)
    .join('');
  const button = action
    ? `<div style="margin:24px 0 8px">
         <a href="${escapeHtml(action.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:600">${escapeHtml(action.label)}</a>
       </div>
       <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">
         Agar tugma ishlamasa, quyidagi havolani brauzerga nusxalang:<br>
         <span style="color:#2563eb;word-break:break-all">${escapeHtml(action.url)}</span>
       </p>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:28px 32px">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">🏘 Mahalla OS</h1>
      <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">Raqamli Mahalla Boshqaruv Tizimi</p>
    </div>
    <div style="padding:28px 32px">
      <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600">${escapeHtml(subject)}</h2>
      ${lines}
      ${button}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        Bu xabar Mahalla OS tizimidan avtomatik yuborilgan. Iltimos, bu xabarga javob bermang.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendMail(to: string, subject: string, body: string, action?: MailAction): Promise<void> {
  const t = getTransport();
  if (t) {
    try {
      await t.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text: action ? `${body}\n\n${action.label}: ${action.url}` : body,
        html: buildHtml(subject, body, action),
      });
    } catch (err) {
      console.error('[MAILER] SMTP error, falling back to console:', err);
      console.log(`\n📧 [FALLBACK MAIL] to=${to}\n   subject: ${subject}\n   ${body}${action ? `\n   ${action.label}: ${action.url}` : ''}\n`);
    }
  } else {
    console.log(`\n📧 [MOCK MAIL] to=${to}\n   subject: ${subject}\n   ${body}${action ? `\n   ${action.label}: ${action.url}` : ''}\n`);
  }
}

/** Verify SMTP connection — call on startup if needed */
export async function verifySmtp(): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch {
    return false;
  }
}
