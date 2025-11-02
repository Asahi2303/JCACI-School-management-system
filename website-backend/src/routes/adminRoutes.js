const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { sendMfaCodeEmail, sendEmail, verifySmtp } = require('../utils/mailer');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return next();
  }
  res.redirect('/admin/login');
};

// Publicly accessible login page
// Render the local EJS view so design matches the main site
router.get('/login', (req, res) => {
	// preserve any flashed error if available
	const error = req.session && req.session.loginError;
	if (req.session) delete req.session.loginError;

	// Generate CSRF token
	const csrfToken = crypto.randomBytes(32).toString('hex');
	req.session.csrfToken = csrfToken;

	res.render('admin/login', { title: 'Admin Login', error, csrfToken });
});

// Normalize incoming login request and forward to controller with error handling
router.post('/login', async (req, res, next) => {
	// Rate limiting: 5 attempts per 15 minutes
	const now = Date.now();
	if (!req.session.loginAttempts) req.session.loginAttempts = [];
	req.session.loginAttempts = req.session.loginAttempts.filter(attempt => now - attempt < 15 * 60 * 1000); // Remove old attempts
	if (req.session.loginAttempts.length >= 5) {
		console.warn('Login rate limit exceeded for IP:', req.ip);
		return res.status(429).render('admin/login', { title: 'Admin Login', error: 'Too many login attempts. Try again later.' });
	}

	// CSRF check
	if (!req.body.csrfToken || req.body.csrfToken !== req.session.csrfToken) {
		console.warn('CSRF token mismatch for IP:', req.ip);
		return res.status(403).render('admin/login', { title: 'Admin Login', error: 'Invalid request.' });
	}

	try {
		// Accept either "email" (new form) or "username" (legacy controller)
		if (!req.body.username && req.body.email) {
			// copy/trim to username so existing controller works unchanged
			req.body.username = String(req.body.email || '').trim();
		}
		// If controller returns/throws, await to catch exceptions
		await Promise.resolve(adminController.loginUser(req, res, next));
	} catch (err) {
		// Record failed attempt
		req.session.loginAttempts.push(now);

		// Log succinctly for debugging
		console.error('Admin login error:', err && err.message ? err.message : err);

		// Map common Supabase error to friendly message
		let msg = 'Authentication failed. Please check your email and password.';
		if (err && (err.code === 'invalid_credentials' || (err.status === 400 && err.code === 'invalid_credentials'))) {
			msg = 'Invalid email or password.';
		}

		// If response already sent by controller, stop; otherwise re-render login view with error
		if (res.headersSent) return;

		// Render the admin/login view so the client-side popup will display the message
		res.status(401).render('admin/login', { title: 'Admin Login', error: msg });
	}
});

// Enforce POST logout to reduce CSRF risk (keep GET redirect as fallback if needed)
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    try { res.clearCookie('connect.sid', { path: '/' }); } catch (e) {}
    res.redirect('/');
  });
});

// MFA: show code entry page (only if password step passed)
router.get('/mfa', (req, res) => {
  if (!req.session || req.session.authStage !== 'password_ok' || !req.session.pendingUserEmail) {
    return res.redirect('/admin/login');
  }
  const error = req.session.mfaError; delete req.session.mfaError;
  // new token for CSRF
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = csrfToken;
  res.render('admin/mfa', { title: 'Verify code', error, csrfToken });
});

// MFA: verify code
router.post('/mfa', async (req, res) => {
  if (!req.session || req.session.authStage !== 'password_ok' || !req.session.pendingUserEmail) {
    return res.redirect('/admin/login');
  }
  if (!req.body.csrfToken || req.body.csrfToken !== req.session.csrfToken) {
    req.session.mfaError = 'Invalid request.';
    return res.redirect('/admin/mfa');
  }
  const code = String(req.body.code || '').trim();
  const now = Date.now();
  const expires = req.session.mfaExpiresAt || 0;
  const expected = req.session.mfaCode;
  if (!expected || now > expires) {
    req.session.mfaError = 'Code expired. Please request a new one.';
    return res.redirect('/admin/mfa');
  }
  // Basic timing-safe compare
  const a = Buffer.from(code);
  const b = Buffer.from(String(expected));
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    req.session.mfaAttempts = (req.session.mfaAttempts || 0) + 1;
    if (req.session.mfaAttempts >= 5) {
      // lock out and reset
      req.session.authStage = null; req.session.pendingUserEmail = null; req.session.mfaCode = null;
      req.session.mfaExpiresAt = null; req.session.mfaAttempts = 0;
      req.session.loginError = 'Too many invalid codes. Please sign in again.';
      return res.redirect('/admin/login');
    }
    req.session.mfaError = 'Invalid code. Please try again.';
    return res.redirect('/admin/mfa');
  }
  // Success: finalize login
  req.session.isLoggedIn = true;
  req.session.user = { email: req.session.pendingUserEmail };
  req.session.authStage = null;
  req.session.pendingUserEmail = null;
  req.session.mfaCode = null;
  req.session.mfaExpiresAt = null;
  req.session.mfaAttempts = 0;
  res.redirect('/admin');
});

// MFA: resend code (rate limit simple)
router.post('/mfa/resend', async (req, res) => {
  if (!req.session || req.session.authStage !== 'password_ok' || !req.session.pendingUserEmail) {
    return res.redirect('/admin/login');
  }
  const now = Date.now();
  if (req.session.lastMfaSendAt && now - req.session.lastMfaSendAt < 60 * 1000) {
    req.session.mfaError = 'Please wait a minute before requesting a new code.';
    return res.redirect('/admin/mfa');
  }
  const code = ('' + Math.floor(100000 + Math.random() * 900000)); // 6-digit
  req.session.mfaCode = code;
  req.session.mfaExpiresAt = now + 10 * 60 * 1000; // 10 minutes
  req.session.lastMfaSendAt = now;
  try {
    await sendMfaCodeEmail(req.session.pendingUserEmail, code);
  } catch (e) {
    console.error('MFA email send failed:', e);
    req.session.mfaError = 'Failed to send code. Try again shortly.';
    return res.redirect('/admin/mfa');
  }
  res.redirect('/admin/mfa');
});

// Multer storage: save into the backend public uploads/facilities folder
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'facilities'); // website-backend/public/uploads/facilities
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${base}-${unique}${ext}`);
  }
});
const imageFileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image uploads are allowed'), false);
  cb(null, true);
};
const upload = multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Helper wrapper: accept multiple field names and normalize req.file for downstream controller
const uploadFields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'photoFile', maxCount: 1 },
  { name: 'imageFile', maxCount: 1 }
]);

function handleUpload(req, res, next) {
  uploadFields(req, res, async function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        console.warn('Multer upload error:', err);
        return res.status(400).render('admin/facilities', { error: 'Upload error: ' + err.message });
      }
      return next(err);
    }

    // Debug keys
    try { console.debug('uploadFields result - files keys:', Object.keys(req.files || {})); } catch (e) {}

    // Normalize req.file for controllers expecting a single file
    if (!req.file && req.files) {
      const keys = Object.keys(req.files);
      if (keys.length) {
        req.file = req.files[keys[0]] && req.files[keys[0]][0];
      }
    }

    // If still no file, respond with hint
    if (!req.file) {
      const hint = 'No file detected. Ensure the upload form uses enctype="multipart/form-data" and name one of: photo, image, file, photoFile, imageFile.';
      console.warn('Facility upload failed: no file in request. ' + hint, { bodyKeys: Object.keys(req.body || {}) });
      return res.status(400).render('admin/facilities', { error: 'Failed to upload facility: no file received. ' + hint, form: req.body });
    }

    // Build the public URL for the saved file (served via express.static(public))
    try {
      if (req.file && req.file.filename) {
        // Re-encode image with sharp to strip metadata and ensure safe format
        try {
          const sharp = require('sharp');
          const filePath = req.file.path;
          const tempOut = filePath + '.webp';
          // Resize if larger than 2000px and convert to webp for better safety/size
          await sharp(filePath)
            .rotate()
            .resize({ width: 2000, withoutEnlargement: true })
            .webp({ quality: 84 })
            .toFile(tempOut);

          // replace original with webp file name
          fs.unlinkSync(filePath);
          const newName = req.file.filename + '.webp';
          fs.renameSync(tempOut, path.join(uploadsDir, newName));
          req.file.filename = newName;
          req.file.path = path.join(uploadsDir, newName);
          req.uploadedFileUrl = '/uploads/facilities/' + newName;
          if (!req.body.photoUrl) req.body.photoUrl = req.uploadedFileUrl;
        } catch (err) {
          console.warn('Sharp processing failed for upload:', err);
          req.uploadedFileUrl = '/uploads/facilities/' + req.file.filename;
          if (!req.body.photoUrl) req.body.photoUrl = req.uploadedFileUrl;
        }
      }
    } catch (e) { /* ignore */ }

    return next();
  });
}

// Optional upload middleware: do NOT error if no file (used for editing facilities when only updating text)
function optionalUpload(req, res, next) {
  uploadFields(req, res, async function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        console.warn('Multer optional upload error:', err);
        return res.status(400).render('admin/facilities', { error: 'Upload error: ' + err.message });
      }
      return next(err);
    }

    // Normalize single file reference if provided
    if (!req.file && req.files) {
      const keys = Object.keys(req.files);
      if (keys.length) {
        req.file = req.files[keys[0]] && req.files[keys[0]][0];
      }
    }

    // If still no file, that's acceptable for optional update; continue without setting req.uploadedFileUrl
    if (req.file && req.file.filename) {
      // Provide a simple public URL path (local static)
      req.uploadedFileUrl = '/uploads/facilities/' + req.file.filename;
    }
    return next();
  });
}

// Protected admin routes
router.get('/', isAuthenticated, adminController.getDashboard);
router.get('/dashboard', isAuthenticated, adminController.getDashboard);

// Facilities Management
router.get('/facilities', isAuthenticated, adminController.getFacilities);
// Use the new upload wrapper; ensure admin form file input uses one of the accepted names (photo|image|file|photoFile|imageFile)
router.post('/facilities/upload', isAuthenticated, handleUpload, adminController.uploadFacility);
router.get('/facilities/:id/edit', isAuthenticated, adminController.getFacility);
router.post('/facilities/:id/edit', isAuthenticated, optionalUpload, adminController.updateFacility);
router.post('/facilities/:id/delete', isAuthenticated, adminController.deleteFacility);

// Testimonials Management
router.get('/testimonials', isAuthenticated, adminController.getTestimonials);
router.post('/testimonials/add', isAuthenticated, adminController.addTestimonial);
router.get('/testimonials/:id/edit', isAuthenticated, adminController.getTestimonial);
router.post('/testimonials/:id/edit', isAuthenticated, adminController.updateTestimonial);
router.post('/testimonials/:id/toggle', isAuthenticated, adminController.toggleTestimonialFeatured);
router.post('/testimonials/:id/delete', isAuthenticated, adminController.deleteTestimonial);

// Settings Management
router.get('/settings', isAuthenticated, adminController.getSettings);
router.post('/settings/seo', isAuthenticated, adminController.updateSEOSettings);
router.post('/settings/system', isAuthenticated, adminController.updateSystemSettings);
router.post('/settings/site-stats', isAuthenticated, adminController.updateSiteStats);

// Export the router
module.exports = router;

// Admin-only: quick test mail endpoint to verify email delivery from the server
// This sends a simple test email to the logged-in admin's email (or an optional ?to= param)
// Keep it lightweight and avoid exposing publicly; relies on isAuthenticated middleware
router.post('/test-mail', isAuthenticated, async (req, res) => {
  try {
    const to = (req.body && req.body.to) || (req.query && req.query.to) || (req.session.user && req.session.user.email);
    if (!to) return res.status(400).json({ ok: false, error: 'No recipient resolved. Provide ?to= or ensure session.user.email is set.' });
    const brand = process.env.BRAND_NAME || 'Jolly Children Academic Center';
    const subject = `[${brand}] Test email`;
    const text = `This is a test email from the ${brand} admin server.`;
    const html = `<p>This is a <strong>test email</strong> from the ${brand} admin server.</p>`;
    const info = await sendEmail({ to, subject, text, html });
    return res.json({ ok: true, to, info: info && (info.provider ? { provider: info.provider, statusCode: info.statusCode } : { messageId: info.messageId }) });
  } catch (err) {
    console.error('test-mail error:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Failed to send test email.' });
  }
});

// Admin-only: verify SMTP connectivity and configuration quickly
router.post('/test-smtp', isAuthenticated, async (req, res) => {
  try {
    const result = await verifySmtp();
    return res.json({ ok: !!result.ok, result });
  } catch (err) {
    console.error('test-smtp error:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: 'Failed to verify SMTP.' });
  }
});
