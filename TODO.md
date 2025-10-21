# Admin Security Improvements TODO

- [x] Remove unused handleLogin function and hardcoded credentials from adminController.js
- [ ] Update authMiddleware.js to check req.session.isLoggedIn consistently
- [ ] Add CSRF protection to login routes in adminRoutes.js
- [ ] Implement rate limiting for login attempts in adminRoutes.js
- [ ] Strengthen password validation in adminController.js
- [ ] Add login attempt logging in adminController.js
- [ ] Enhance input sanitization in adminController.js
- [ ] Configure secure session management in server-fixed.js
- [ ] Add HTTPS enforcement in server-fixed.js
- [ ] Test login functionality
- [ ] Implement 2FA for admin login (future)

# Admin Settings Cleanup TODO

- [x] Remove General Settings and Appearance Settings from admin dashboard (they should be permanent)
