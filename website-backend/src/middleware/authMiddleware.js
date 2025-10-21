// filepath: website-backend/src/middleware/authMiddleware.js
// This middleware checks if a user is logged in before allowing access to a route
exports.isLoggedIn = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return next(); // If logged in, proceed to the next function (the controller)
  }
  res.redirect('/admin/login'); // If not logged in, redirect to the login page
};
