# Contact Form Email Configuration

The contact form uses Nodemailer to send submissions to your designated inbox.

## Required Environment Variables
Set these in your `.env` (server root) or hosting provider environment.

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false          # true for port 465 (SSL), false for STARTTLS (587)
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password_or_app_password
FROM_EMAIL=notifications@yourdomain.com   # Optional; falls back to SMTP_USER
CONTACT_RECIPIENT=info@yourdomain.com     # Where form submissions are delivered
```

If `SMTP_HOST/PORT/USER/PASS` are not set, the app will fall back to a stream (log-only) transport and emails will NOT actually send (they'll appear in server logs).

## Spam / Abuse Mitigation
- Honeypot fields: `website` and `phone` (hidden from users) – bots often fill them.
- Basic length + empty field checks.
- You can add a rate limiter per IP in `apiRoutes` or a dedicated middleware if spam increases.

## Example `.env`
```
NODE_ENV=production
SESSION_SECRET=change-me
SUPABASE_URL=... (existing)
SUPABASE_ANON_KEY=... (existing)
SUPABASE_SERVICE_ROLE_KEY=... (existing)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youraccount@gmail.com
SMTP_PASS=app-specific-password
FROM_EMAIL=youraccount@gmail.com
CONTACT_RECIPIENT=schooloffice@yourdomain.com
```

## Testing Locally
Without SMTP variables the console will show a warning and the raw generated email (stream transport).

To test with a real mailbox, supply the environment variables and restart the server.

## Future Enhancements (Optional)
- Add CAPTCHA (hCaptcha or Cloudflare Turnstile) for further spam reduction.
- Persist submissions in a `contact_messages` table for audit/history.
- Add auto-reply acknowledgment email to sender.
