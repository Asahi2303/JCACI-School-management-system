const nodemailer = require('nodemailer');
let sgMail = null;
// Prefer HTTP API (SendGrid) when available to avoid SMTP port blocks/timeouts
if (process.env.SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (e) {
    console.warn('[mailer] @sendgrid/mail not available, will fall back to SMTP:', e && e.message ? e.message : e);
    sgMail = null;
  }
}

let transporter;

// Helpers
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}
function isValidEmail(value) {
  const v = normalizeEmail(value);
  // Simplified RFC5322-ish check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function createTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      // Add reasonable timeouts to fail fast when SMTP is unreachable
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT) || 10000,
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT) || 10000,
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT) || 10000,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  } else {
    // Fallback: stream transport (logs emails to console, doesn't send)
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    console.warn('[mailer] SMTP not configured. Emails will not be sent (stream transport).');
    transporter._isStream = true;
  }
  transporter._fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost';
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  // Try SendGrid first if configured
  if (sgMail) {
    try {
      const from = normalizeEmail(process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost');
      const toNorm = normalizeEmail(to);
      if (!isValidEmail(toNorm)) {
        throw new Error(`Invalid recipient email address: "${to}"`);
      }
      if (!process.env.FROM_EMAIL) {
        console.warn('[mailer] FROM_EMAIL not set. SendGrid requires a verified sender/domain. Set FROM_EMAIL to a verified sender in your SendGrid account.');
      }
      const enableSandbox = String(process.env.SENDGRID_SANDBOX_MODE || '').toLowerCase() === 'true';
      const payload = enableSandbox ? { to: toNorm, from, subject, text, html, mailSettings: { sandboxMode: { enable: true } } } : { to: toNorm, from, subject, text, html };
      const [resp] = await sgMail.send(payload);
      console.log('[mailer] email sent via SendGrid:', subject, resp && resp.statusCode);
      return { provider: 'sendgrid', statusCode: resp && resp.statusCode };
    } catch (err) {
      try {
        const status = err && err.code ? ` code=${err.code}` : '';
        const respCode = err && err.response && err.response.statusCode ? ` status=${err.response.statusCode}` : '';
        const respErrors = err && err.response && err.response.body && err.response.body.errors ? ` errors=${JSON.stringify(err.response.body.errors)}` : '';
        console.error(`[mailer] SendGrid send failed, will fallback to SMTP/console:${status}${respCode}${respErrors}`);
      } catch (logErr) {
        console.error('[mailer] SendGrid send failed, will fallback to SMTP/console:', err && err.message ? err.message : err);
      }
    }
  }
  // Fallback to SMTP (or stream console)
  const tx = createTransporter();
  const toNorm = normalizeEmail(to);
  const info = await tx.sendMail({ from: tx._fromAddress, to: toNorm, subject, text, html });
  if (info && info.message) console.log('[mailer] email generated:', subject);
  return info;
}

async function sendMfaCodeEmail(to, code) {
  // Optional recipient override for testing/admin purposes
  const envOverride = process.env.MFA_RECIPIENT_OVERRIDE;
  // Prefer override if it looks like a valid email; otherwise fall back to provided "to"
  let overrideTo = isValidEmail(envOverride) ? normalizeEmail(envOverride) : normalizeEmail(to);
  const subject = 'Your verification code';
  const text = `Your verification code is: ${code}\nIt expires in 10 minutes.`;
  const brandName = process.env.BRAND_NAME || 'Jolly Children Academic Center';
  const brandLogo = process.env.BRAND_LOGO_URL || '';
  const primary = process.env.BRAND_PRIMARY_COLOR || '#2E7D32';
  const accent = process.env.BRAND_ACCENT_COLOR || '#4CAF50';
  const supportEmail = process.env.SUPPORT_EMAIL || (process.env.FROM_EMAIL || 'no-reply@localhost');
  const companyAddress = process.env.COMPANY_ADDRESS || '';
  const html = `
  <div style="background:#f5f7fb; padding:24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px; margin:0 auto; font-family:Inter,Arial,Helvetica,sans-serif; color:#1a1a1a;">
      <tr>
        <td style="padding:24px 24px 0; text-align:center;">
          ${brandLogo ? `<img src="${brandLogo}" alt="${brandName}" style="max-height:56px; max-width:100%; object-fit:contain;" />` : `<div style="font-size:20px; font-weight:700; color:${primary};">${brandName}</div>`}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 0;">
          <div style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.06);">
            <div style="padding:24px 24px 0;">
              <h1 style="margin:0 0 8px; font-size:20px; line-height:1.3; color:#111;">Verify your login</h1>
              <p style="margin:0; color:#444;">Use the following code to complete your sign-in:</p>
            </div>
            <div style="padding:20px 24px 8px; text-align:center;">
              <div style="display:inline-block; padding:14px 18px; letter-spacing:6px; font-size:26px; font-weight:800; color:#fff; background:${primary}; border-radius:10px;">${code}</div>
            </div>
            <div style="padding:0 24px 16px;">
              <p style="margin:12px 0 0; font-size:14px; color:#555;">This code will expire in 10 minutes. If you didn’t request this, you can ignore this email.</p>
            </div>
            <div style="height:1px; background:#eee; margin:0 24px;"></div>
            <div style="padding:16px 24px 24px;">
              <p style="margin:0; font-size:12px; color:#6b7280;">If the button/code doesn’t work, you can manually enter it in the verification page. For assistance, contact us at <a style="color:${accent}; text-decoration:none;" href="mailto:${supportEmail}">${supportEmail}</a>.</p>
            </div>
          </div>
          <div style="text-align:center; padding:16px 12px; color:#9aa3b2; font-size:12px;">
            <div style="margin:6px 0;">${brandName}</div>
            ${companyAddress ? `<div style="margin:6px 0;">${companyAddress}</div>` : ''}
          </div>
        </td>
      </tr>
    </table>
  </div>`;
  // Prefer explicit console fallback in dev/testing
  if (String(process.env.MFA_LOG_TO_CONSOLE).toLowerCase() === 'true') {
    if (overrideTo !== to) {
      console.log(`[MFA] Verification code for ${to} (overridden to ${overrideTo}): ${code}`);
    } else {
      console.log(`[MFA] Verification code for ${to}: ${code}`);
    }
    // In console/stream mode, skip actual send to avoid errors in environments without SMTP
    return Promise.resolve({ accepted: [overrideTo], messageId: 'console-only' });
  }

  // Try SendGrid first (HTTP API — avoids SMTP timeouts)
  if (sgMail) {
    try {
      const from = normalizeEmail(process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost');
      if (!isValidEmail(overrideTo)) {
        console.warn(`[mailer] Invalid MFA recipient email. Falling back to console logging. to="${to}" override="${envOverride}"`);
        console.log(`[MFA][FALLBACK] Verification code for ${to}: ${code}`);
        return Promise.resolve({ accepted: [to], messageId: 'invalid-to-console-fallback' });
      }
      if (!process.env.FROM_EMAIL) {
        console.warn('[mailer] FROM_EMAIL not set. SendGrid requires a verified sender/domain. Set FROM_EMAIL to a verified sender in your SendGrid account.');
      }
      const enableSandbox = String(process.env.SENDGRID_SANDBOX_MODE || '').toLowerCase() === 'true';
      const payload = enableSandbox ? { to: overrideTo, from, subject, text, html, mailSettings: { sandboxMode: { enable: true } } } : { to: overrideTo, from, subject, text, html };
      const [resp] = await sgMail.send(payload);
      console.log('[mailer] MFA email sent via SendGrid:', resp && resp.statusCode);
      return { provider: 'sendgrid', statusCode: resp && resp.statusCode };
    } catch (err) {
      try {
        const status = err && err.code ? ` code=${err.code}` : '';
        const respCode = err && err.response && err.response.statusCode ? ` status=${err.response.statusCode}` : '';
        const respErrors = err && err.response && err.response.body && err.response.body.errors ? ` errors=${JSON.stringify(err.response.body.errors)}` : '';
        console.error(`[mailer] SendGrid MFA send failed, will fallback to SMTP/console:${status}${respCode}${respErrors}`);
      } catch (logErr) {
        console.error('[mailer] SendGrid MFA send failed, will fallback to SMTP/console:', err && err.message ? err.message : err);
      }
    }
  }

  // Fallback to SMTP; if it fails, log code to console
  const tx = createTransporter();
  try {
    if (!isValidEmail(overrideTo)) {
      console.warn(`[mailer] Invalid MFA recipient for SMTP path. Falling back to console logging. to="${to}" override="${envOverride}"`);
      console.log(`[MFA][FALLBACK] Verification code for ${to}: ${code}`);
      return Promise.resolve({ accepted: [to], messageId: 'invalid-to-console-fallback' });
    }
    return await tx.sendMail({ from: tx._fromAddress, to: overrideTo, subject, text, html });
  } catch (err) {
    console.error('[mailer] SMTP send failed, falling back to console logging:', err && err.message ? err.message : err);
    if (overrideTo !== to) {
      console.log(`[MFA][FALLBACK] Verification code for ${to} (overridden to ${overrideTo}): ${code}`);
    } else {
      console.log(`[MFA][FALLBACK] Verification code for ${to}: ${code}`);
    }
    return Promise.resolve({ accepted: [overrideTo], messageId: 'console-fallback' });
  }
}

// Verify SMTP connectivity for diagnostics
async function verifySmtp() {
  const tx = createTransporter();
  if (tx._isStream) {
    return { ok: false, mode: 'stream', message: 'SMTP not configured; using console stream transport.' };
  }
  try {
    await tx.verify();
    return { ok: true, host: tx.options && tx.options.host, port: tx.options && tx.options.port, secure: tx.options && tx.options.secure };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

module.exports = { sendEmail, sendMfaCodeEmail, verifySmtp };
