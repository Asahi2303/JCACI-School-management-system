const express = require('express');
const router = express.Router();
const { getTestimonialsData, getFacilitiesData } = require('../controllers/dataController');
const Settings = require('../models/Settings');
const apiController = require('../controllers/apiController');
const formController = require('../controllers/formController');

router.get('/testimonials', getTestimonialsData);
router.get('/facilities', getFacilitiesData);

// Public Site Stats
router.get('/site-stats', async (req, res) => {
	try {
		let stats = {
			totalStudents: 450,
			totalStaff: 48,
			totalClubsTeams: 15,
			yearsOfJoy: 12
		};

		try {
			const stored = await Settings.getByCategory('site_stats');
			if (stored) {
				stats = {
					totalStudents: stored.totalStudents ?? stats.totalStudents,
					totalStaff: stored.totalStaff ?? stats.totalStaff,
					totalClubsTeams: stored.totalClubsTeams ?? stats.totalClubsTeams,
					yearsOfJoy: stored.yearsOfJoy ?? stats.yearsOfJoy
				};
			}
		} catch (inner) {
			console.warn('Site stats fetch fallback to defaults:', inner && inner.message ? inner.message : inner);
		}

		res.json(stats);
	} catch (error) {
		console.error('Error serving site stats:', error);
		res.status(500).json({ error: 'Failed to load site stats' });
	}
});

router.get('/content', apiController.getSiteContent);

// Contact Form Submission
router.post('/contact', formController.handleContactForm);

module.exports = router;


