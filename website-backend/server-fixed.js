require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const adminRoutes = require('./src/routes/adminRoutes');
const apiRoutes = require('./src/routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS: restrict allowed origins in production
const allowedOrigin = process.env.CORS_ORIGIN || null; // set in env for production
if (allowedOrigin) {
	app.use(cors({ origin: allowedOrigin }));
} else {
	app.use(cors());
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use(helmet({
	contentSecurityPolicy: false, // We'll add CSP separately (report-only) to avoid blocking third-party widgets initially
	crossOriginEmbedderPolicy: false, // Allow cross-origin iframes like Google Maps & Facebook plugins
	crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } // Relax COOP to avoid isolation issues with embeds
}));

// Basic rate limiting for all requests (tweak limits as needed)
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 80 }); // 80 reqs per minute per IP
app.use(apiLimiter);

// Session middleware
app.use(session({
	secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key',
	resave: false,
	saveUninitialized: false,
	cookie: { 
		secure: process.env.NODE_ENV === 'production',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 1000 * 60 * 60 * 4 // 4 hours
	}
}));

// View engine setup
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// Helper: unwrap possible module shapes to get an Express router / middleware function
function resolveMiddleware(mod) {
	// unwrap default (ESM interop)
	if (mod && mod.default) mod = mod.default;

	// common export: { router: router } or { default: router }
	if (mod && mod.router) mod = mod.router;

	// Accept Express router (function with .use) or plain middleware function
	if (typeof mod === 'function') return mod;

	// Some routers might be objects that implement use() (very rare) — accept them
	if (mod && typeof mod.use === 'function') return mod;

	// Unknown shape
	return null;
}

// Routes (use resolved middleware; fail fast with helpful message)
const adminRouter = resolveMiddleware(adminRoutes);
const apiRouter = resolveMiddleware(apiRoutes);

if (!adminRouter) {
	console.error('Invalid export from ./src/routes/adminRoutes — expected an Express router or middleware function.');
	console.error('Export shapes supported: module.exports = router; OR module.exports = { router }; OR export default router;');
	process.exit(1);
}
if (!apiRouter) {
	console.error('Invalid export from ./src/routes/apiRoutes — expected an Express router or middleware function.');
	process.exit(1);
}

// IMPORTANT: mount route handlers BEFORE serving front-end static files
app.use('/admin', adminRouter);
app.use('/api', apiRouter);

// Serve static files after route mounting so routes like /admin/login are handled by adminRouter
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend root
app.use(express.static(path.join(__dirname, 'public'))); // Serve backend public (includes /uploads/facilities)

// Root route to serve the index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


