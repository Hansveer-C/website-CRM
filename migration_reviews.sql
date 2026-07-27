-- Migration: Social Proof / Reviews Table
-- Goal: Prompt W7.1 (Social Proof)

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- The owner of the website/business
    name TEXT NOT NULL, -- Name of the reviewer
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT NOT NULL, -- Review text
    location TEXT, -- Optional location info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policies: Only the business owner can manage their reviews
CREATE POLICY "Users can manage their own reviews" ON reviews
    FOR ALL
    USING (auth.uid() = user_id);

-- Policy: Everyone can read reviews for display on public websites
CREATE POLICY "Anyone can read reviews" ON reviews
    FOR SELECT
    USING (true);

-- Index for performance when fetching reviews for a specific business
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
