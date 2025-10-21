// filepath: website-backend/src/controllers/formController.js
// Handles Contact Form submissions: validates input, basic spam checks, sends email via Nodemailer
const nodemailer = require('nodemailer');

// Lazy transporter (reuse after first creation)
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  // Expect SMTP env vars; fallback to console transport if missing
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT, 10) || 587,
      secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  } else {
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
    console.warn('[ContactForm] SMTP credentials missing; using stream transport (emails not actually sent).');
  }
  return transporter;
}

const validateEmail = (email) => /^(?!.{255,})([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+)\.[A-Z]{2,}$/i.test(email || '');

const handleContactForm = async (req, res) => {
  try {
    const acceptJson = req.headers.accept && req.headers.accept.includes('application/json');
    const { name, email, message, website, phone } = req.body || {}; // website/phone potential honeypot fields

    // Basic honeypot: reject if 'website' or 'phone' filled (we'll add them hidden in markup)
    if ((website && website.trim()) || (phone && phone.trim())) {
      console.warn('[ContactForm] Honeypot triggered');
      return acceptJson ? res.status(200).json({ status: 'ok' }) : res.redirect('/?success=1');
    }

    // Validation
    const errors = [];
    if (!name || !name.trim()) errors.push('Name is required');
    if (!email || !validateEmail(email)) errors.push('Valid email is required');
    if (!message || !message.trim()) errors.push('Message is required');
    if (message && message.split(/\s+/).length < 3) errors.push('Message is too short');

    if (errors.length) {
      if (acceptJson) return res.status(400).json({ errors });
      return res.redirect('/?error=' + encodeURIComponent(errors.join(', ')) + '#contact-form');
    }

    const meta = {
      ip: req.ip,
      ua: req.headers['user-agent'] || 'N/A',
      referer: req.headers['referer'] || 'N/A'
    };

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
      to: process.env.CONTACT_RECIPIENT || process.env.FROM_EMAIL || process.env.SMTP_USER || 'admin@example.com',
      subject: `New Contact Form Message from ${name}`,
      text: `You have received a new contact form submission.\n\nName: ${name}\nEmail: ${email}\nMessage:\n${message}\n\n--\nMeta:\nIP: ${meta.ip}\nUser-Agent: ${meta.ua}\nReferrer: ${meta.referer}`,
      html: `<p>You have received a new contact form submission.</p>
             <p><strong>Name:</strong> ${escapeHtml(name)}<br>
             <strong>Email:</strong> ${escapeHtml(email)}</p>
             <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g,'<br>')}</p>
             <hr><p style="font-size:12px;color:#666;">IP: ${escapeHtml(meta.ip)}<br>User-Agent: ${escapeHtml(meta.ua)}<br>Referrer: ${escapeHtml(meta.referer)}</p>`
    };

    const tx = getTransporter();
    const info = await tx.sendMail(mailOptions);
    if (info && info.messageId) {
      console.log('[ContactForm] Email queued with id', info.messageId);
    } else {
      console.log('[ContactForm] Email processed (stream in dev).');
    }

    if (acceptJson) return res.json({ status: 'ok' });
    return res.redirect('/?success=' + encodeURIComponent('Message sent') + '#contact-form');
  } catch (error) {
    console.error('Error submitting contact form:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ error: 'Failed to submit contact form' });
    }
    return res.redirect('/?error=' + encodeURIComponent('Failed to send message') + '#contact-form');
  }
};

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

module.exports = {
  handleContactForm,
};