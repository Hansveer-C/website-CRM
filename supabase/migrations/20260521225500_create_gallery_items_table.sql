-- Create gallery_items table for persistent before/after gallery (WB.1.3)
CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  title TEXT,
  service_type TEXT,
  city TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_gallery_items_user_id ON gallery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_service_type ON gallery_items(service_type);
CREATE INDEX IF NOT EXISTS idx_gallery_items_city ON gallery_items(city);
CREATE INDEX IF NOT EXISTS idx_gallery_items_is_featured ON gallery_items(is_featured);

-- Enable RLS
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own gallery items
CREATE POLICY "Users can manage their own gallery items"
  ON gallery_items
  FOR ALL
  USING (auth.uid()::text = user_id);

-- Policy: Anyone can view gallery items (for public website)
CREATE POLICY "Anyone can view gallery items"
  ON gallery_items
  FOR SELECT
  USING (true);
