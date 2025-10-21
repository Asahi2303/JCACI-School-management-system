const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Admin Dashboard
router.get('/dashboard', adminController.getDashboard);

// Facilities Management
router.get('/facilities', adminController.getFacilities);
router.post('/facilities/upload', adminController.uploadFacility);

// Testimonials Management
router.get('/testimonials', adminController.getTestimonials);
router.post('/testimonials/add', adminController.addTestimonial);

// Settings Management
router.get('/settings', adminController.getSettings);
router.post('/settings/general', adminController.updateGeneralSettings);
router.post('/settings/appearance', adminController.updateAppearanceSettings);
router.post('/settings/seo', adminController.updateSEOSettings);
router.post('/settings/system', adminController.updateSystemSettings);

// Admin Login
router.get('/login', adminController.getLoginPage);
router.post('/login', adminController.loginUser);
router.post('/logout', adminController.logoutUser);

// Export the router
module.exports = router;