const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Facility = require('../models/Facility');
const Testimonial = require('../models/Testimonial');
const Settings = require('../models/Settings');
require('dotenv').config();
// Use configured Supabase clients (anon & service role) from config
const { supabase, supabaseAdmin } = require('../config/supabase');

// Default settings (will be replaced by database)
let settings = {
  general: {
    siteName: 'Jolly Children Academic Center',
    siteDescription: 'Premier academic center providing quality education for children with experienced teachers and modern facilities.',
    contactEmail: 'info@jollychildren.edu',
    contactPhone: '+1 (555) 123-4567'
  },
  appearance: {
    primaryColor: '#2E7D32',
    secondaryColor: '#4CAF50',
    maintenanceMode: false,
    showTestimonials: true,
    showFacilities: true
  },
  seo: {
    metaTitle: 'Jolly Children Academic Center - Quality Education for Kids',
    metaDescription: 'Premier academic center providing quality education for children with experienced teachers and modern facilities. Enroll your child today!',
    keywords: 'education, children, academic center, school, learning, kids'
  },
  system: {
    maxFileSize: 5,
    sessionTimeout: 30,
    enableLogging: true
  },
  site_stats: {
    totalStudents: 450,
    totalStaff: 48,
    totalClubsTeams: 15,
    yearsOfJoy: 12
  }
};

// Admin Dashboard (DB-backed counts with graceful fallback)
const getDashboard = async (req, res) => {
  const diagnostics = { facilities: { source: 'count', value: 0, fallback: false, error: null }, testimonials: { source: 'count', value: 0, fallback: false, error: null } };
  try {
    // Attempt fast COUNT queries
    try {
      diagnostics.facilities.value = await Facility.count();
    } catch (e) {
      diagnostics.facilities.error = e && e.message ? e.message : String(e);
      // Fallback to full fetch length
      try {
        const all = await Facility.findAll();
        diagnostics.facilities.value = Array.isArray(all) ? all.length : 0;
        diagnostics.facilities.fallback = true;
        diagnostics.facilities.source = 'findAll-length';
      } catch (inner) {
        diagnostics.facilities.error += ' | fallback failed: ' + (inner && inner.message ? inner.message : inner);
      }
    }
    try {
      diagnostics.testimonials.value = await Testimonial.count();
    } catch (e) {
      diagnostics.testimonials.error = e && e.message ? e.message : String(e);
      try {
        const allT = await Testimonial.findAll();
        diagnostics.testimonials.value = Array.isArray(allT) ? allT.length : 0;
        diagnostics.testimonials.fallback = true;
        diagnostics.testimonials.source = 'findAll-length';
      } catch (innerT) {
        diagnostics.testimonials.error += ' | fallback failed: ' + (innerT && innerT.message ? innerT.message : innerT);
      }
    }

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalFacilities: diagnostics.facilities.value,
        totalTestimonials: diagnostics.testimonials.value,
        websiteVisitors: 156,
        contactForms: 24
      },
      statsDiagnostics: diagnostics
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalFacilities: 0,
        totalTestimonials: 0,
        websiteVisitors: 156,
        contactForms: 24
      },
      error: 'Error loading dashboard data'
    });
  }
};

// Facilities Management
const getFacilities = async (req, res) => {
  try {
    const diagnostics = { db: { ok: false, count: 0, error: null }, json: { used: false, count: 0, path: null, exists: false }, merged: { count: 0 } };

    // Helper: normalize a facility record into template shape
    const normalize = (f) => ({
      id: (f && (typeof f.id === 'number' || typeof f.id === 'string')) ? String(f.id) : '',
      title: (f && (f.title || f.name)) || '',
      description: (f && f.description) || '',
      imageUrl: (f && (f.image_url || f.imageUrl || f.image)) || '',
      imageThumb: (f && (f.image_thumb_url || f.image_thumb_url || f.imageThumb)) || null,
      createdAt: (f && (f.created_at || f.createdAt)) || ''
    });

    let dbFacilities = [];
    try {
      const rawDb = await Facility.findAll();
      if (Array.isArray(rawDb)) dbFacilities = rawDb.map(normalize);
      diagnostics.db.ok = true;
      diagnostics.db.count = dbFacilities.length;
    } catch (err) {
      diagnostics.db.error = err && err.message ? err.message : String(err);
      console.warn('[Facilities] DB fetch failed; will attempt JSON fallback:', diagnostics.db.error);
    }

    // JSON fallback (merge instead of replace)
    const dataFile = path.join(__dirname, '..', 'data', 'facilities.json');
    diagnostics.json.path = dataFile;
    let jsonFacilities = [];
    if (fs.existsSync(dataFile)) {
      diagnostics.json.exists = true;
      try {
        const rawStr = await fs.promises.readFile(dataFile, 'utf8');
        const parsed = JSON.parse(rawStr || '[]');
        if (Array.isArray(parsed)) {
          jsonFacilities = parsed.map(normalize);
          diagnostics.json.used = true;
          diagnostics.json.count = jsonFacilities.length;
        }
      } catch (readErr) {
        diagnostics.json.error = readErr && readErr.message ? readErr.message : String(readErr);
        console.warn('[Facilities] JSON fallback read failed:', diagnostics.json.error);
      }
    }

    let facilities;
    if (dbFacilities.length > 0) {
      // If DB has records, prefer ONLY DB to avoid legacy JSON duplicates unless JSON contains ids absent in DB with valid fields
      const dbIds = new Set(dbFacilities.map(f => f.id));
      const supplemental = jsonFacilities.filter(f => f.id && !dbIds.has(f.id));
      if (supplemental.length) {
        console.info(`[Facilities] Adding ${supplemental.length} supplemental legacy JSON facilities not present in DB.`);
      }
      facilities = dbFacilities.concat(supplemental);
    } else {
      // DB empty/unavailable -> fallback purely to JSON
      facilities = jsonFacilities;
    }

    // Detect accidental duplication (same title+imageUrl) and collapse
    const dedupeMap = new Map();
    facilities.forEach(f => {
      const key = (f.title || '') + '|' + (f.imageUrl || '');
      if (!dedupeMap.has(key)) dedupeMap.set(key, f);
    });
    const before = facilities.length;
    facilities = Array.from(dedupeMap.values());
    if (facilities.length !== before) {
      console.info(`[Facilities] Dedupe removed ${before - facilities.length} duplicate facility records.`);
    }
    diagnostics.merged.count = facilities.length;

    if (facilities.length === 0) {
      if (!diagnostics.db.ok) {
        console.info('[Facilities] Empty list: DB unavailable and no JSON fallback records.');
      } else if (diagnostics.db.ok && diagnostics.db.count === 0 && diagnostics.json.count === 0) {
        console.info('[Facilities] DB reachable but returned 0 rows; JSON fallback empty.');
      }
    }

    res.render('admin/facilities', {
      title: 'Facilities Management',
      facilities,
      errorMessage: req.query.error,
      successMessage: req.query.success,
      facilitiesDiagnostics: diagnostics
    });
  } catch (error) {
    console.error('Error loading facilities (unhandled):', error);
    res.render('admin/facilities', {
      title: 'Facilities Management',
      facilities: [],
      errorMessage: 'Error loading facilities',
      successMessage: req.query.success,
      facilitiesDiagnostics: { fatal: error && error.message ? error.message : String(error) }
    });
  }
};

// New robust uploadFacility implementation:
// - uses req.uploadedFileUrl (set by multer wrapper) or req.file
// - appends a facility record to src/data/facilities.json
async function uploadFacility(req, res) {
  try {
    // Ensure we have an uploaded URL
  let imageUrl = req.uploadedFileUrl || (req.file && req.file.filename ? ('/uploads/facilities/' + req.file.filename) : null);

    if (!imageUrl) {
      const hint = 'No uploaded image found. Ensure the form used multipart/form-data and the file input name matches.';
      console.warn('uploadFacility: no imageUrl', { bodyKeys: Object.keys(req.body || {}) });
      return res.status(400).render('admin/facilities', { error: 'Failed to upload facility: ' + hint, form: req.body });
    }

    // Collect metadata from form
    const title = (req.body.title || req.body.name || '').trim();
    const description = (req.body.description || req.body.desc || '').trim();

    // Attempt to insert into Supabase via Facility model
    try {
      // If we have a multer file and a service-role Supabase client, process and upload to Supabase Storage
      try {
        if (req.file && supabaseAdmin) {
          const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'facilities';
          // generate base name
          const baseName = `facility-${Date.now()}-${(req.file.originalname || 'upload').replace(/\s+/g, '-')}`;
          try {
            // read file buffer (multer wrote to disk)
            const fileBuffer = await fs.promises.readFile(req.file.path);

            // process full image (max width 1200) and thumbnail (300)
            const fullBuf = await sharp(fileBuffer).resize({ width: 1200, withoutEnlargement: true }).toFormat('webp', { quality: 80 }).toBuffer();
            const thumbBuf = await sharp(fileBuffer).resize({ width: 300 }).toFormat('webp', { quality: 75 }).toBuffer();

            // upload full
            const fullPath = `${baseName}.webp`;
            const upFull = await supabaseAdmin.storage.from(bucket).upload(fullPath, fullBuf, { contentType: 'image/webp' });
            if (upFull && upFull.error) throw upFull.error;

            // upload thumb
            const thumbPath = `${baseName}-thumb.webp`;
            const upThumb = await supabaseAdmin.storage.from(bucket).upload(thumbPath, thumbBuf, { contentType: 'image/webp' });
            if (upThumb && upThumb.error) throw upThumb.error;

            // get public urls
            try {
              const pubFull = await supabase.storage.from(bucket).getPublicUrl(fullPath);
              const pubThumb = await supabase.storage.from(bucket).getPublicUrl(thumbPath);
              imageUrl = (pubFull && pubFull.data && (pubFull.data.publicUrl || pubFull.data.publicURL)) || pubFull.publicURL || imageUrl;
              var imageThumbUrl = (pubThumb && pubThumb.data && (pubThumb.data.publicUrl || pubThumb.data.publicURL)) || pubThumb.publicURL || null;
            } catch (e) {
              try {
                const signedF = await supabaseAdmin.storage.from(bucket).createSignedUrl(fullPath, 60 * 60);
                const signedT = await supabaseAdmin.storage.from(bucket).createSignedUrl(thumbPath, 60 * 60);
                imageUrl = (signedF && signedF.data && (signedF.data.signedUrl || signedF.data.signedURL)) || signedF.signedURL || imageUrl;
                imageThumbUrl = (signedT && signedT.data && (signedT.data.signedUrl || signedT.data.signedURL)) || signedT.signedURL || imageThumbUrl;
              } catch (ee) {
                // ignore
              }
            }

            // Remove local file copy if upload succeeded
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
          } catch (e) {
            console.warn('Image processing or Supabase upload failed; continuing with local file URL', e && e.message ? e.message : e);
          }
        }
      } catch (e) {
        console.warn('Error while attempting to process/upload file to Supabase storage:', e && e.message ? e.message : e);
      }

      // Map to DB column names (schema uses title, description, image_url)
      const created = await Facility.create({
        title: title || ('Facility ' + Date.now()),
        description: description || '',
        image_url: imageUrl,
        image_thumb_url: imageThumbUrl || null
      });

      // Success — redirect to admin list
      return res.redirect('/admin/facilities');
    } catch (dbErr) {
      // If DB insertion fails, fallback to local JSON file for resilience
      console.warn('Facility.create failed, falling back to local JSON file:', dbErr && dbErr.message ? dbErr.message : dbErr);
      const dataDir = path.join(__dirname, '..', 'data');
      const dataFile = path.join(dataDir, 'facilities.json');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      let arr = [];
      if (fs.existsSync(dataFile)) {
        try {
          const raw = await fs.promises.readFile(dataFile, 'utf8');
          arr = JSON.parse(raw || '[]');
          if (!Array.isArray(arr)) arr = [];
        } catch (e) {
          console.warn('Could not read existing facilities.json, starting fresh:', e && e.message);
          arr = [];
        }
      }

      const record = {
        id: Date.now().toString(),
        title: title || ('Facility ' + (arr.length + 1)),
        description: description || '',
        imageUrl: imageUrl,
        createdAt: new Date().toISOString()
      };

      arr.push(record);
      await fs.promises.writeFile(dataFile, JSON.stringify(arr, null, 2), 'utf8');

      return res.redirect('/admin/facilities');
    }

  } catch (err) {
    console.error('Error uploading facility:', err);
    const msg = err && err.message ? err.message : 'Unknown error during upload';
    if (res.headersSent) return;
    return res.status(500).render('admin/facilities', { error: 'Failed to upload facility: ' + msg });
  }
}

// Testimonials Management
const getTestimonials = async (req, res) => {
  try {
    const raw = await Testimonial.findAll();
    const testimonials = Array.isArray(raw) ? raw.map(t => ({
      id: t.id,
      clientName: t.client_name || t.clientName || 'Anonymous',
      clientRole: t.client_role || t.clientRole || 'Parent',
      content: t.content || '',
      rating: typeof t.rating === 'number' ? t.rating : (parseInt(t.rating) || 5),
      isFeatured: !!(t.is_featured || t.isFeatured),
      createdAt: t.created_at || t.createdAt || new Date().toISOString()
    })) : [];

    res.render('admin/testimonials', {
      title: 'Testimonials Management',
      testimonials,
      errorMessage: req.query.error,
      successMessage: req.query.success,
      editId: req.query.editId || null
    });
  } catch (error) {
    console.error('Error loading testimonials:', error);
    res.render('admin/testimonials', {
      title: 'Testimonials Management',
      testimonials: [],
      errorMessage: 'Error loading testimonials',
      successMessage: req.query.success,
      editId: req.query.editId || null
    });
  }
};

const addTestimonial = async (req, res) => {
  try {
    const { clientName, clientRole, testimonialContent, rating, isFeatured } = req.body;

    // Whitelist validation for role
    const allowedRoles = ['Student', 'Teacher', 'Parent', 'Guardian', 'Staff', 'Visitor'];
    if (!clientRole || !allowedRoles.includes(clientRole)) {
      return res.redirect('/admin/testimonials?error=Invalid role provided');
    }

    if (!clientName || !testimonialContent) {
      return res.redirect('/admin/testimonials?error=Missing required fields');
    }

    const newTestimonial = await Testimonial.create({
      client_name: clientName,
      client_role: clientRole,
      content: testimonialContent,
      rating: parseInt(rating) || 5,
      is_featured: isFeatured === 'true'
    });

    res.redirect('/admin/testimonials?success=Testimonial added successfully');
  } catch (error) {
    console.error('Error adding testimonial:', error);
    res.redirect('/admin/testimonials?error=Failed to add testimonial');
  }
};

// Settings Management
const getSettings = async (req, res) => {
  try {
    const settingsData = await Settings.getAll();
    // settingsData is already an object with categories as keys

    // Merge with defaults for any missing categories
    const mergedSettings = {
      seo: { ...settings.seo, ...settingsData.seo },
      system: { ...settings.system, ...settingsData.system },
      site_stats: { ...settings.site_stats, ...settingsData.site_stats }
    };

    res.render('admin/settings', {
      title: 'Settings',
      settings: mergedSettings,
      query: req.query
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.render('admin/settings', {
      title: 'Settings',
      settings: settings,
      query: req.query,
      error: 'Error loading settings'
    });
  }
};



const updateSEOSettings = async (req, res) => {
  try {
    const { metaTitle, metaDescription, keywords } = req.body;

    // Update in-memory settings
    settings.seo = {
      metaTitle,
      metaDescription,
      keywords
    };

    // Save to database
    await Settings.upsert({
      category: 'seo',
      settings: {
        metaTitle,
        metaDescription,
        keywords
      }
    });

    res.redirect('/admin/settings?success=SEO settings updated successfully');
  } catch (error) {
    console.error('Error updating SEO settings:', error);
    res.redirect('/admin/settings?error=Failed to update SEO settings');
  }
};

const updateSystemSettings = async (req, res) => {
  try {
    const { maxFileSize, sessionTimeout, enableLogging } = req.body;

    // Update in-memory settings
    settings.system = {
      maxFileSize: parseInt(maxFileSize),
      sessionTimeout: parseInt(sessionTimeout),
      enableLogging: enableLogging === 'on'
    };

    // Save to database
    await Settings.upsert({
      category: 'system',
      settings: {
        maxFileSize: parseInt(maxFileSize),
        sessionTimeout: parseInt(sessionTimeout),
        enableLogging: enableLogging === 'on'
      }
    });

    res.redirect('/admin/settings?success=System settings updated successfully');
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.redirect('/admin/settings?error=Failed to update system settings');
  }
};

// Update Site Statistics
const updateSiteStats = async (req, res) => {
  try {
    const { totalStudents, totalStaff, totalClubsTeams, yearsOfJoy } = req.body;

    function sanitizeInt(value, fallback = 0, opts = {}) {
      let v = parseInt(value, 10);
      if (isNaN(v) || v < 0) v = fallback;
      if (opts.max && v > opts.max) v = opts.max;
      return v;
    }

    const sanitized = {
      totalStudents: sanitizeInt(totalStudents, settings.site_stats.totalStudents, { max: 100000 }),
      totalStaff: sanitizeInt(totalStaff, settings.site_stats.totalStaff, { max: 5000 }),
      totalClubsTeams: sanitizeInt(totalClubsTeams, settings.site_stats.totalClubsTeams, { max: 1000 }),
      yearsOfJoy: sanitizeInt(yearsOfJoy, settings.site_stats.yearsOfJoy, { max: 200 })
    };

    // Update in-memory
    settings.site_stats = sanitized;

    // Persist
    await Settings.upsert({
      category: 'site_stats',
      settings: sanitized
    });

    res.redirect('/admin/settings?success=Site statistics updated successfully');
  } catch (error) {
    console.error('Error updating site statistics:', error);
    res.redirect('/admin/settings?error=Failed to update site statistics');
  }
};

// Facilities CRUD Operations
const getFacility = async (req, res) => {
  try {
    const facilityId = req.params.id;
  const rawFacility = await Facility.findById(facilityId);

    if (!rawFacility) {
      return res.redirect('/admin/facilities?error=Facility not found');
    }

    // Normalize field names for consistency with templates
    const facility = {
      id: rawFacility.id,
      title: rawFacility.title,
      description: rawFacility.description,
      imageUrl: rawFacility.image_url || rawFacility.imageUrl || '',
      createdAt: rawFacility.created_at || rawFacility.createdAt
    };

    res.render('admin/edit-facility', {
      title: 'Edit Facility',
      facility: facility,
      errorMessage: req.query.error,
      successMessage: req.query.success
    });
  } catch (error) {
    console.error('Error loading facility:', error);
    res.redirect('/admin/facilities?error=Error loading facility');
  }
};

const updateFacility = async (req, res) => {
  try {
    const facilityId = req.params.id;
    const { title, description } = req.body;
    let imageUrl = req.body.currentImageUrl; // Keep existing image if no new upload
    let imageThumbUrl = null;

    // If a new image was uploaded, use the new URL
    if (req.file && supabaseAdmin) {
      // process new image same as upload flow
      try {
        const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'facilities';
        const baseName = `facility-${Date.now()}-${(req.file.originalname || 'upload').replace(/\s+/g, '-')}`;
        const fileBuffer = await fs.promises.readFile(req.file.path);
        const fullBuf = await sharp(fileBuffer).resize({ width: 1200, withoutEnlargement: true }).toFormat('webp', { quality: 80 }).toBuffer();
        const thumbBuf = await sharp(fileBuffer).resize({ width: 300 }).toFormat('webp', { quality: 75 }).toBuffer();

        const fullPath = `${baseName}.webp`;
        const thumbPath = `${baseName}-thumb.webp`;
        const upFull = await supabaseAdmin.storage.from(bucket).upload(fullPath, fullBuf, { contentType: 'image/webp' });
        if (upFull && upFull.error) throw upFull.error;
        const upThumb = await supabaseAdmin.storage.from(bucket).upload(thumbPath, thumbBuf, { contentType: 'image/webp' });
        if (upThumb && upThumb.error) throw upThumb.error;

        // get public urls
        try {
          const pubFull = await supabase.storage.from(bucket).getPublicUrl(fullPath);
          const pubThumb = await supabase.storage.from(bucket).getPublicUrl(thumbPath);
          imageUrl = (pubFull && pubFull.data && (pubFull.data.publicUrl || pubFull.data.publicURL)) || pubFull.publicURL || imageUrl;
          imageThumbUrl = (pubThumb && pubThumb.data && (pubThumb.data.publicUrl || pubThumb.data.publicURL)) || pubThumb.publicURL || null;
        } catch (e) {
          try {
            const signedF = await supabaseAdmin.storage.from(bucket).createSignedUrl(fullPath, 60 * 60);
            const signedT = await supabaseAdmin.storage.from(bucket).createSignedUrl(thumbPath, 60 * 60);
            imageUrl = (signedF && signedF.data && (signedF.data.signedUrl || signedF.data.signedURL)) || signedF.signedURL || imageUrl;
            imageThumbUrl = (signedT && signedT.data && (signedT.data.signedUrl || signedT.data.signedURL)) || signedT.signedURL || imageThumbUrl;
          } catch (ee) { /* ignore */ }
        }

        // Remove local file copy
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }

        // Attempt to delete previous objects if they were in the same bucket
        try {
          const prev = await Facility.findById(facilityId);
          if (prev && prev.image_url) {
            // attempt to extract object path from URL (common Supabase public URL pattern)
            const maybePath = prev.image_url.split('/').slice(-1)[0];
            if (maybePath) {
              try { await supabaseAdmin.storage.from(bucket).remove([maybePath]); } catch (e) {/* ignore */}
            }
          }
          if (prev && prev.image_thumb_url) {
            const maybeThumb = prev.image_thumb_url.split('/').slice(-1)[0];
            if (maybeThumb) {
              try { await supabaseAdmin.storage.from(bucket).remove([maybeThumb]); } catch (e) {/* ignore */}
            }
          }
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('Failed to process/upload replacement image:', e && e.message ? e.message : e);
      }
    } else if (req.uploadedFileUrl) {
      // Local optional upload (no Supabase admin client) path
      imageUrl = req.uploadedFileUrl;
    } // else no new file: retain current imageUrl

    // Try to update in DB first
    try {
      await Facility.update(facilityId, {
        title: title || 'Untitled Facility',
        description: description || '',
        image_url: imageUrl,
        image_thumb_url: imageThumbUrl || null
      });
      return res.redirect('/admin/facilities?success=Facility updated successfully');
    } catch (dbErr) {
      console.warn('Facility.update failed, attempting JSON fallback:', dbErr && dbErr.message ? dbErr.message : dbErr);

      // Fallback to JSON file
      const dataDir = path.join(__dirname, '..', 'data');
      const dataFile = path.join(dataDir, 'facilities.json');

      if (fs.existsSync(dataFile)) {
        try {
          const raw = await fs.promises.readFile(dataFile, 'utf8');
          let arr = JSON.parse(raw || '[]');
          if (!Array.isArray(arr)) arr = [];

          const index = arr.findIndex(f => String(f.id) === String(facilityId));
          if (index !== -1) {
            arr[index] = {
              ...arr[index],
              title: title || 'Untitled Facility',
              description: description || '',
              imageUrl: imageUrl,
              createdAt: arr[index].createdAt || new Date().toISOString()
            };
            await fs.promises.writeFile(dataFile, JSON.stringify(arr, null, 2), 'utf8');
            return res.redirect('/admin/facilities?success=Facility updated successfully');
          } else {
            throw new Error('Facility not found in JSON');
          }
        } catch (readErr) {
          console.error('Failed to update facility in JSON fallback:', readErr);
          throw readErr;
        }
      } else {
        throw new Error('No JSON fallback file found');
      }
    }
  } catch (error) {
    console.error('Error updating facility:', error);
    res.redirect(`/admin/facilities/${req.params.id}/edit?error=Failed to update facility`);
  }
};

const deleteFacility = async (req, res) => {
  try {
    const facilityId = req.params.id;

    // Try to delete from DB first
    try {
      // Get facility info before deletion for cleanup
  const facility = await Facility.findById(facilityId);
      if (facility && facility.image_url && facility.image_url.startsWith('/uploads/')) {
        // Try to delete the image file
        try {
          const imagePath = path.join(__dirname, '..', 'public', facility.image_url);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (fileError) {
          console.warn('Could not delete facility image file:', fileError);
        }
      }

      await Facility.delete(facilityId);
      return res.redirect('/admin/facilities?success=Facility deleted successfully');
    } catch (dbErr) {
      console.warn('Facility.destroy failed, attempting JSON fallback:', dbErr && dbErr.message ? dbErr.message : dbErr);

      // Fallback to JSON file
      const dataDir = path.join(__dirname, '..', 'data');
      const dataFile = path.join(dataDir, 'facilities.json');

      if (fs.existsSync(dataFile)) {
        try {
          const raw = await fs.promises.readFile(dataFile, 'utf8');
          let arr = JSON.parse(raw || '[]');
          if (!Array.isArray(arr)) arr = [];

          const index = arr.findIndex(f => String(f.id) === String(facilityId));
          if (index !== -1) {
            // Try to delete image file if it's a local upload
            const facility = arr[index];
            if (facility.imageUrl && facility.imageUrl.startsWith('/uploads/')) {
              try {
                const imagePath = path.join(__dirname, '..', 'public', facility.imageUrl);
                if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
                }
              } catch (fileError) {
                console.warn('Could not delete facility image file:', fileError);
              }
            }

            arr.splice(index, 1);
            await fs.promises.writeFile(dataFile, JSON.stringify(arr, null, 2), 'utf8');
            return res.redirect('/admin/facilities?success=Facility deleted successfully');
          } else {
            throw new Error('Facility not found in JSON');
          }
        } catch (readErr) {
          console.error('Failed to delete facility in JSON fallback:', readErr);
          throw readErr;
        }
      } else {
        throw new Error('No JSON fallback file found');
      }
    }
  } catch (error) {
    console.error('Error deleting facility:', error);
    res.redirect('/admin/facilities?error=Failed to delete facility');
  }
};

// Testimonials CRUD Operations
const getTestimonial = async (req, res) => {
  // Instead of rendering a separate edit page, redirect to the testimonials list
  // with an editId query param so the inline editor can be used.
  try {
    const testimonialId = req.params.id;
    const testimonial = await Testimonial.findById(testimonialId);
    if (!testimonial) return res.redirect('/admin/testimonials?error=Testimonial not found');
    return res.redirect(`/admin/testimonials?editId=${encodeURIComponent(testimonialId)}`);
  } catch (error) {
    console.error('Error loading testimonial:', error);
    return res.redirect('/admin/testimonials?error=Error loading testimonial');
  }
};

const updateTestimonial = async (req, res) => {
  try {
    const testimonialId = req.params.id;
    const { clientName, clientRole, testimonialContent, rating, isFeatured } = req.body;

    // Whitelist validation for role
    const allowedRoles = ['Student', 'Teacher', 'Parent', 'Guardian', 'Staff', 'Visitor'];
    if (!clientRole || !allowedRoles.includes(clientRole)) {
      return res.redirect(`/admin/testimonials?error=Invalid role provided&editId=${encodeURIComponent(testimonialId)}`);
    }

    if (!clientName || !testimonialContent) {
      return res.redirect(`/admin/testimonials?error=Missing required fields&editId=${encodeURIComponent(testimonialId)}`);
    }

    await Testimonial.update(testimonialId, {
      client_name: clientName,
      client_role: clientRole,
      content: testimonialContent,
      rating: parseInt(rating) || 5,
      is_featured: isFeatured === 'true'
    });

    res.redirect('/admin/testimonials?success=Testimonial updated successfully');
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.redirect(`/admin/testimonials/${req.params.id}/edit?error=Failed to update testimonial`);
  }
};

const toggleTestimonialFeatured = async (req, res) => {
  try {
    const testimonialId = req.params.id;
  const testimonial = await Testimonial.findById(testimonialId);

    if (!testimonial) {
      return res.redirect('/admin/testimonials?error=Testimonial not found');
    }

    await Testimonial.update(testimonialId, { is_featured: !testimonial.is_featured });

    res.redirect('/admin/testimonials?success=Testimonial featured status updated');
  } catch (error) {
    console.error('Error toggling testimonial featured status:', error);
    res.redirect('/admin/testimonials?error=Failed to update testimonial status');
  }
};

const deleteTestimonial = async (req, res) => {
  try {
    const testimonialId = req.params.id;

    await Testimonial.delete(testimonialId);

    res.redirect('/admin/testimonials?success=Testimonial deleted successfully');
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.redirect('/admin/testimonials?error=Failed to delete testimonial');
  }
};



// User Authentication with Supabase
const getLoginPage = (req, res) => {
  res.render('login');
};

const loginUser = async (req, res) => {
  // Sanitize inputs
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  // Log login attempt
  console.log(`Login attempt: email=${email}, ip=${req.ip || req.connection.remoteAddress}, userAgent=${req.get('User-Agent')}`);

  // Basic validation
  if (!email || !password) {
    console.warn('Login failed: missing email or password');
    return res.redirect('/admin/login?error=Email and password are required');
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.warn('Login failed: invalid email format');
    return res.redirect('/admin/login?error=Invalid email format');
  }



  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  })

  if (error) {
    console.error('Supabase sign-in error:', error);
    console.log(`Login failed for ${email}: ${error.message}`);
    return res.redirect('/admin/login?error=Invalid credentials');
  }

  console.log(`Password verified for ${email}`);
  // Stage MFA via email code (do not mark logged in yet)
  req.session.authStage = 'password_ok';
  req.session.pendingUserEmail = data.user.email;
  req.session.loginAttempts = []; // Clear attempts on success
  try {
    const { sendMfaCodeEmail } = require('../utils/mailer');
    const code = ('' + Math.floor(100000 + Math.random() * 900000)); // 6-digit
    req.session.mfaCode = code;
    req.session.mfaExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    await sendMfaCodeEmail(data.user.email, code);
  } catch (e) {
    console.error('Failed to send MFA email:', e);
    req.session.loginError = 'We could not send your verification code. Please try again.';
    return res.redirect('/admin/login');
  }
  return res.redirect('/admin/mfa');
};

const logoutUser = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};

// Export functions
module.exports = {
  getDashboard,
  getFacilities,
  uploadFacility,
  getFacility,
  updateFacility,
  deleteFacility,
  getTestimonials,
  addTestimonial,
  getTestimonial,
  updateTestimonial,
  toggleTestimonialFeatured,
  deleteTestimonial,
  getSettings,
  updateSEOSettings,
  updateSystemSettings,
  updateSiteStats,
  getLoginPage,
  loginUser,
  logoutUser
};
