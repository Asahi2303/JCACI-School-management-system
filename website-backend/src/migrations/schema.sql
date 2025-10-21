-- Facilities table
CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
  image_thumb_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(100) NOT NULL,
    client_role VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(20) NOT NULL UNIQUE,
    settings JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_facilities_created_at ON facilities(created_at);
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON testimonials(created_at);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- Insert default settings
INSERT INTO settings (category, settings) VALUES
('general', '{
  "siteName": "Jolly Children Academic Center",
  "siteDescription": "Premier academic center providing quality education for children with experienced teachers and modern facilities.",
  "contactEmail": "info@jollychildren.edu",
  "contactPhone": "+1 (555) 123-4567"
}'::jsonb),
('appearance', '{
  "primaryColor": "#2E7D32",
  "secondaryColor": "#4CAF50",
  "maintenanceMode": false,
  "showTestimonials": true,
  "showFacilities": true
}'::jsonb),
('seo', '{
  "metaTitle": "Jolly Children Academic Center - Quality Education for Kids",
  "metaDescription": "Premier academic center providing quality education for children with experienced teachers and modern facilities. Enroll your child today!",
  "keywords": "education, children, academic center, school, learning, kids"
}'::jsonb),
('system', '{
  "maxFileSize": 5,
  "sessionTimeout": 30,
  "enableLogging": true
}'::jsonb) ON CONFLICT (category) DO NOTHING;

ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS image_thumb_url TEXT;
