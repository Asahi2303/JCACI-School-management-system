const Facility = require('../models/Facility');
const Testimonial = require('../models/Testimonial');
const Settings = require('../models/Settings');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get all facilities
exports.getFacilities = async (req, res) => {
  try {
    const facilities = await Facility.findAll();
    res.json(facilities);
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
};

// Get all testimonials
exports.getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.findAll();
    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
};

// Get featured testimonials
exports.getFeaturedTestimonials = async (req, res) => {
  try {
    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching featured testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch featured testimonials' });
  }
};

// Get site settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getAll();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// Placeholder for fetching all site content for the frontend
exports.getSiteContent = async (req, res) => {
  try {
    // Fetch site content from database or any other source
    const siteContent = {
      siteName: 'Jolly Children Academic Center',
      description: 'Welcome to our website!',
    };
    res.json(siteContent);
  } catch (error) {
    console.error('Error fetching site content:', error);
    res.status(500).json({ error: 'Failed to fetch site content' });
  }
};
