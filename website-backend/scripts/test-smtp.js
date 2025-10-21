require('dotenv').config();
const { sendEmail, sendMfaCodeEmail } = require('../src/utils/mailer');

(async () => {
  try {
    const to = process.env.CONTACT_RECIPIENT || process.env.FROM_EMAIL || process.env.SMTP_USER;
    if (!to) {
      console.error('Set CONTACT_RECIPIENT or FROM_EMAIL or SMTP_USER in .env to run this test.');
      process.exit(1);
    }
    const info = await sendEmail({
      to,
      subject: 'SMTP Test: JCACI backend',
      text: 'This is a plain text test email from the JCACI backend.',
      html: '<p>This is a <b>test email</b> from the JCACI backend.</p>'
    });
    console.log('Test email result:', info && info.messageId ? info.messageId : info);

    // Optional: also test MFA email path
    if (String(process.env.TEST_MFA_EMAIL || '').toLowerCase() === 'true') {
      const code = ('' + Math.floor(100000 + Math.random() * 900000));
      const mfaInfo = await sendMfaCodeEmail(to, code);
      console.log('MFA email result:', mfaInfo && mfaInfo.messageId ? mfaInfo.messageId : mfaInfo);
    }
    process.exit(0);
  } catch (e) {
    console.error('SMTP test failed:', e);
    process.exit(2);
  }
})();
