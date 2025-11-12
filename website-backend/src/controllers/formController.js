// filepath: website-backend/src/controllers/formController.js
// Handles Contact Form submissions: validates input, basic spam checks, sends email via unified sendEmail (SendGrid-first)
const { sendEmail } = require('../utils/mailer');

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

    const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com';
    const toAddress = process.env.CONTACT_RECIPIENT || process.env.FROM_EMAIL || process.env.SMTP_USER || 'admin@example.com';
    const subject = `New Contact Form Message from ${name}`;
    const plain = `You have received a new contact form submission.\n\nName: ${name}\nEmail: ${email}\nMessage:\n${message}\n\n--\nMeta:\nIP: ${meta.ip}\nUser-Agent: ${meta.ua}\nReferrer: ${meta.referer}`;
    const html = `<p>You have received a new contact form submission.</p>
             <p><strong>Name:</strong> ${escapeHtml(name)}<br>
             <strong>Email:</strong> ${escapeHtml(email)}</p>
             <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g,'<br>')}</p>
             <hr><p style="font-size:12px;color:#666;">IP: ${escapeHtml(meta.ip)}<br>User-Agent: ${escapeHtml(meta.ua)}<br>Referrer: ${escapeHtml(meta.referer)}</p>`;

    try {
      const info = await sendEmail({ to: toAddress, subject, text: plain, html });
      if (info && info.provider === 'sendgrid') {
        console.log('[ContactForm] Email sent via SendGrid status:', info.statusCode);
      } else if (info && info.messageId) {
        console.log('[ContactForm] Email queued with id', info.messageId);
      } else {
        console.log('[ContactForm] Email processed (fallback/stream).');
      }
    } catch (mailErr) {
      console.error('[ContactForm] sendEmail failed, fallback notice:', mailErr && mailErr.message ? mailErr.message : mailErr);
      // Do not surface internal error details to user; treat as failure path below
      if (acceptJson) return res.status(500).json({ error: 'Failed to send message' });
      return res.redirect('/?error=' + encodeURIComponent('Failed to send message') + '#contact-form');
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