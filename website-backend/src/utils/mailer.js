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
  const subject = 'Your verification code';
  const text = `Your verification code is: ${code}\nIt expires in 10 minutes.`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif; line-height:1.6;">
      <h2 style="margin:0 0 8px;">Verify your login</h2>
      <p>Use the following code to complete your sign-in:</p>
      <p style="font-size:22px; font-weight:700; letter-spacing:3px;">${code}</p>
      <p style="color:#555;">This code will expire in 10 minutes. If you didn\'t request this, you can ignore this email.</p>
    </div>
  `;
  const tx = createTransporter();
  // Explicit dev/testing console fallback
  if (String(process.env.MFA_LOG_TO_CONSOLE).toLowerCase() === 'true' || tx._isStream) {
    console.log(`[MFA] Verification code for ${to}: ${code}`);
    // In console/stream mode, skip actual send to avoid errors in environments without SMTP
    return Promise.resolve({ accepted: [to], messageId: 'console-only' });
  }
  return tx.sendMail({ from: tx._fromAddress, to, subject, text, html });
}

module.exports = { sendEmail, sendMfaCodeEmail };
