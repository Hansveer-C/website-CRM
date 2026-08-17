-- Add contact_id to event_logs
ALTER TABLE event_logs ADD COLUMN contact_id TEXT;

-- Move existing contact_id from payload to explicit column
UPDATE event_logs 
SET contact_id = payload->>'contact_id'
WHERE payload ? 'contact_id';

-- Ensure all tables have indexes for (user_id, contact_id, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_messages_timeline ON messages (user_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_timeline ON calls (user_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_timeline ON activities (user_id, contact_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_timeline ON event_logs (user_id, contact_id, created_at DESC);

-- Foreign key for event_logs.contact_id
ALTER TABLE event_logs 
ADD CONSTRAINT event_logs_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id);
