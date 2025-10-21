// In-memory storage fallback when database is not available
class MemoryStorage {
  constructor() {
    this.facilities = [];
    this.testimonials = [];
    this.settings = {
      general: {
        siteName: 'Jolly Children Academic Center',
        siteDescription: 'Premier academic center providing quality education for children',
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
        metaTitle: 'Jolly Children Academic Center',
        metaDescription: 'Quality education for children',
        keywords: 'education, children, academic center'
      },
      system: {
        maxFileSize: 5,
        sessionTimeout: 30,
        enableLogging: true
      }
    };
    this.nextId = 1;
  }

  // Facilities methods
  async createFacility(data) {
    const facility = {
      _id: this.nextId++,
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.facilities.push(facility);
    return facility;
  }

  async getFacilities() {
    return this.facilities.sort((a, b) => b.createdAt - a.createdAt);
  }

  async countFacilities() {
    return this.facilities.length;
  }

  // Testimonials methods
  async createTestimonial(data) {
    const testimonial = {
      _id: this.nextId++,
      clientName: data.clientName,
      clientRole: data.clientRole,
      content: data.content,
      rating: data.rating || 5,
      isFeatured: data.isFeatured || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.testimonials.push(testimonial);
    return testimonial;
  }

  async getTestimonials() {
    return this.testimonials.sort((a, b) => b.createdAt - a.createdAt);
  }

  async countTestimonials() {
    return this.testimonials.length;
  }

  // Settings methods
  async getSettings() {
    return this.settings;
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    return this.settings;
  }
}

module.exports = new MemoryStorage();
