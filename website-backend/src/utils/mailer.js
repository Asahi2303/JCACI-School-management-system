const nodemailer = require('nodemailer');

let transporter;

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
  const tx = createTransporter();
  const info = await tx.sendMail({
    from: tx._fromAddress,
    to,
    subject,
    text,
    html
  });
  if (info && info.message) {
    console.log('[mailer] email generated:', subject);
  }
  return info;
}

async function sendMfaCodeEmail(to, code) {
  // Optional recipient override for testing/admin purposes
  const overrideTo = process.env.MFA_RECIPIENT_OVERRIDE || to;
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
  const tx = createTransporter();
  // Explicit dev/testing console fallback
  if (String(process.env.MFA_LOG_TO_CONSOLE).toLowerCase() === 'true' || tx._isStream) {
    if (overrideTo !== to) {
      console.log(`[MFA] Verification code for ${to} (overridden to ${overrideTo}): ${code}`);
    } else {
      console.log(`[MFA] Verification code for ${to}: ${code}`);
    }
    // In console/stream mode, skip actual send to avoid errors in environments without SMTP
    return Promise.resolve({ accepted: [overrideTo], messageId: 'console-only' });
  }

  // Try to send via SMTP; if it fails (timeout, connection error, etc.), log the error
  // and fallback to logging the code to the server console so the login flow can continue.
  try {
    return await tx.sendMail({ from: tx._fromAddress, to: overrideTo, subject, text, html });
  } catch (err) {
    console.error('[mailer] SMTP send failed, falling back to console logging:', err && err.message ? err.message : err);
    if (overrideTo !== to) {
      console.log(`[MFA][FALLBACK] Verification code for ${to} (overridden to ${overrideTo}): ${code}`);
    } else {
      console.log(`[MFA][FALLBACK] Verification code for ${to}: ${code}`);
    }
    // Return a resolved-like object so callers treat this as a non-fatal send
    return Promise.resolve({ accepted: [overrideTo], messageId: 'console-fallback' });
  }
}

module.exports = { sendEmail, sendMfaCodeEmail };
