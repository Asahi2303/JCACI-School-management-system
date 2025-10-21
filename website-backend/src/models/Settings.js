const { supabase } = require('../config/supabase');

class Settings {
  static async getAll() {
    const { data, error } = await supabase
      .from('settings')
      .select('*');

    if (error) throw error;

    // Convert to key-value object
    const settings = {};
    data.forEach(setting => {
      settings[setting.category] = setting.settings;
    });

    return settings;
  }

  static async getByCategory(category) {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('category', category)
      .single();

    if (error) throw error;
    return data.settings;
  }

  static async update(category, settingsData) {
    const { data, error } = await supabase
      .from('settings')
      .update({
        settings: settingsData,
        updated_at: new Date().toISOString()
      })
      .eq('category', category)
      .select()
      .single();

    if (error) throw error;
    return data.settings;
  }

  // Upsert: insert new category row or update existing
  static async upsert({ category, settings: settingsData }) {
    if (!category) throw new Error('category is required for settings upsert');
    const payload = [{ category, settings: settingsData, updated_at: new Date().toISOString() }];
    const { data, error } = await supabase
      .from('settings')
      .upsert(payload, { onConflict: 'category' })
      .select()
      .single();
    if (error) throw error;
    return data.settings;
  }

  static async getDefaultSettings() {
    return {
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
  }
}

module.exports = Settings;
