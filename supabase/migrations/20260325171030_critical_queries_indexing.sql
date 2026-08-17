-- contacts: (user_id)
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts (user_id);

-- opportunities: (user_id, contact_id)
CREATE INDEX IF NOT EXISTS idx_opportunities_user_contact ON opportunities (user_id, contact_id);

-- messages: (user_id, contact_id, created_at) - Already partially covered, but ensure exact match or optimized version
-- (Actually, already have idx_messages_timeline on (user_id, contact_id, created_at DESC))

-- calls: (user_id, phone)
CREATE INDEX IF NOT EXISTS idx_calls_user_phone ON calls (user_id, phone);

-- event_logs: (user_id, created_at)
CREATE INDEX IF NOT EXISTS idx_event_logs_user_created ON event_logs (user_id, created_at DESC);
