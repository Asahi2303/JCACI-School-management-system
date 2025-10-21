Setup: environment files and runtime folders

1) Create .env (we added a starter for you)
- Location: website-backend/.env
- Fill in at least the following for a smooth start:
  - SUPABASE_URL (any non-empty string avoids startup errors; real value needed when you actually use the DB)
  - SUPABASE_ANON_KEY (any non-empty string for startup; real key needed for DB)
  - SUPABASE_SERVICE_ROLE_KEY (optional; needed for uploading to Supabase Storage via admin features)
  - SESSION_SECRET (set to a long random string in production)
  - Optional SMTP settings if you want real emails: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL, CONTACT_RECIPIENT
  - Optional CORS_ORIGIN in production (e.g., https://yourdomain.com)

2) Ensure runtime folders exist
- We created website-backend/public/uploads/facilities so image uploads won’t fail locally.

3) Start the server (Windows PowerShell)
- From the website-backend folder:

  # install deps (first time)
  npm install

  # run the app
  node server-fixed.js

- The server reads environment variables from website-backend/.env by default.

4) Notes on Supabase and fallbacks
- The app will start as long as SUPABASE_URL and SUPABASE_ANON_KEY are set to non-empty values. If they’re placeholders, DB calls will fail gracefully in admin pages that have JSON fallbacks (e.g., facilities), but API endpoints depending on Supabase may return errors until you configure real values.

5) Email (optional)
- Without SMTP settings, emails are NOT actually sent; they’re logged to the console using a stream transport. For development, you can set MFA_LOG_TO_CONSOLE=true to view verification codes directly in the terminal.

6) Production tips
- Set NODE_ENV=production, a strong SESSION_SECRET, real SUPABASE_* values, and CORS_ORIGIN to your site origin.
- Configure real SMTP to deliver contact form and MFA emails.
