-- Create reviews table for social proof (S7.1)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  text TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own reviews
CREATE POLICY "Users can manage their own reviews"
  ON reviews
  FOR ALL
  USING (auth.uid()::text = user_id);

-- Policy: Anyone can view reviews (for public website)
CREATE POLICY "Anyone can view reviews"
  ON reviews
  FOR SELECT
  USING (true);
