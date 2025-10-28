const nodemailer = require('nodemailer');

function validateEmail(email) {
  return /^(?!.{255,})([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+)\.[A-Z]{2,}$/i.test(email || '');
}

async function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10) || 587,
      secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || await new Promise((r, rej) => { let d=''; req.on('data', c=>d+=c); req.on('end', ()=>r(JSON.parse(d))); req.on('error', rej); });
    const { name, email, message, website, phone } = body || {};

    // Honeypot
    if ((website && website.trim()) || (phone && phone.trim())) return res.status(200).json({ status: 'ok' });

    const errors = [];
    if (!name || !String(name).trim()) errors.push('Name is required');
    if (!email || !validateEmail(String(email))) errors.push('Valid email required');
    if (!message || String(message).trim().length < 5) errors.push('Message is too short');
    if (errors.length) return res.status(400).json({ errors });

    const to = process.env.CONTACT_RECIPIENT || process.env.FROM_EMAIL || process.env.SMTP_USER || 'admin@example.com';
    const from = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com';

    const text = `You have received a new contact form submission.\n\nName: ${name}\nEmail: ${email}\nMessage:\n${message}`;
    const html = `<p>You have received a new contact form submission.</p><p><strong>Name:</strong> ${name}<br><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br>${String(message).replace(/\n/g,'<br>')}</p>`;

    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({ from, to, subject: `Contact form: ${String(name).slice(0,60)}`, text, html });
      console.log('[api/contact] Email queued id=', info && info.messageId);
      return res.json({ status: 'ok' });
    }

    // Fallback: log and return ok (useful for preview environments)
    console.log('[api/contact] SMTP not configured — contact payload:', { name, email, message });
    return res.json({ status: 'ok', note: 'SMTP not configured; message logged' });
  } catch (err) {
    console.error('api/contact error:', err);
    return res.status(500).json({ error: 'Failed to submit contact form' });
  }
};
