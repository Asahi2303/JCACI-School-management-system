require('dotenv').config();
// Use the configured Supabase clients (anon and service role) from config
const { supabase, supabaseAdmin } = require('../config/supabase');

const getTestimonialsData = async (req, res) => {
  try {
    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching testimonials:', error);
      return res.status(500).json({ error: 'Failed to fetch testimonials' });
    }

    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
};

const getFacilitiesData = async (req, res) => {
  try {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('*');

    if (error) {
      console.error('Error fetching facilities:', error);
      return res.status(500).json({ error: 'Failed to fetch facilities' });
    }

    // Normalize image URLs: handle different storage shapes
  const origin = req.protocol + '://' + req.get('host');
  const fs = require('fs');
  const path = require('path');
  // compute candidate local paths for root-relative URLs
  const projectRoot = path.join(__dirname, '..', '..'); // .../olly-children-site
  const backendPublic = path.join(__dirname, '..', 'public'); // .../website-backend/public

    const normalized = Array.isArray(facilities) ? await Promise.all(facilities.map(async f => {
      const imageRaw = f.image_url || f.imageUrl || f.image || f.photoUrl || null;
      let imageUrl = null;

      try {
        if (!imageRaw) {
          imageUrl = null;
        } else if (typeof imageRaw === 'string' && /^https?:\/\//i.test(imageRaw)) {
          // Already absolute URL
          imageUrl = imageRaw;
        } else if (typeof imageRaw === 'string' && imageRaw.startsWith('/')) {
          // Root-relative path on this server. Verify the file exists in either project root or backend public before returning URL.
          const rel = imageRaw.replace(/^\/+/, ''); // e.g. uploads/facilities/file.jpg
          const projectPath = path.join(projectRoot, rel);
          const backendPath = path.join(backendPublic, rel);
          if (fs.existsSync(projectPath)) {
            imageUrl = origin + imageRaw; // served from project root
          } else if (fs.existsSync(backendPath)) {
            imageUrl = origin + imageRaw; // served from backend public (same URL path)
          } else {
            // file not found locally; leave imageUrl null so client can use placeholder or fallback
            console.warn('Facility image referenced but not found locally:', imageRaw);
            imageUrl = null;
          }
        } else if (typeof imageRaw === 'string') {
          // Possibly a Supabase storage path like "bucket/path/to/file.jpg" or just "path/to/file.jpg"
          const storageLike = /^[^\/]+\/.+\.[a-zA-Z]{2,5}$/.test(imageRaw);
          if (storageLike) {
            // Treat first path segment as bucket
            const parts = imageRaw.split('/');
            const bucket = parts.shift();
            const objectPath = parts.join('/');

            // Try public URL first (works for public buckets)
            try {
              const publicRes = await supabase.storage.from(bucket).getPublicUrl(objectPath);
              // Support both v1/v2 return shapes
              if (publicRes && publicRes.data && (publicRes.data.publicUrl || publicRes.data.publicURL)) {
                imageUrl = publicRes.data.publicUrl || publicRes.data.publicURL;
              } else if (publicRes && publicRes.publicURL) {
                imageUrl = publicRes.publicURL;
              } else if (publicRes && publicRes.data && publicRes.data?.publicUrl) {
                imageUrl = publicRes.data.publicUrl;
              }
            } catch (e) { /* ignore */ }

            // If not public and we have service role client, attempt signed URL
            if (!imageUrl && supabaseAdmin) {
              try {
                const signedRes = await supabaseAdmin.storage.from(bucket).createSignedUrl(objectPath, 60 * 60); // 1 hour
                if (signedRes && signedRes.data && (signedRes.data.signedUrl || signedRes.data.signedURL)) {
                  imageUrl = signedRes.data.signedUrl || signedRes.data.signedURL;
                } else if (signedRes && signedRes.signedURL) {
                  imageUrl = signedRes.signedURL;
                }
              } catch (e) { /* ignore */ }
            }

            // As a last resort, if the objectPath looks like a filename, try server public uploads path
            if (!imageUrl && objectPath) {
              imageUrl = origin + '/uploads/facilities/' + objectPath.split('/').pop();
            }
          } else {
            // Non-storage relative path: try to resolve against public prefixes
            imageUrl = origin + '/' + imageRaw.replace(/^\/+/, '');
          }
        }
      } catch (e) {
        console.warn('Error normalizing facility image for id=' + (f.id || f._id || '') + ':', e && e.message ? e.message : e);
      }

      return { ...f, imageUrl };
    })) : facilities;

    res.json(normalized);
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
};

module.exports = {
  getTestimonialsData,
  getFacilitiesData
};
