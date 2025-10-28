const { createClient } = require('@supabase/supabase-js');

async function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function useMemoryStorage() {
  try {
    const mem = require('../website-backend/src/models/MemoryStorage');
    return mem;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sb = await getSupabase();
    if (sb) {
      const { data, error } = await sb.from('testimonials').select('*').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: 'Failed to fetch testimonials' });
      return res.json(data || []);
    }

    const mem = await useMemoryStorage();
    if (mem && typeof mem.getTestimonials === 'function') {
      const data = await mem.getTestimonials();
      return res.json(data || []);
    }

    return res.json([]);
  } catch (err) {
    console.error('api/testimonials error:', err);
    return res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
};
