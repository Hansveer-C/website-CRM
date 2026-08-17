
-- Phase S4: Finalize Referential Integrity & Cascade Deletion Security.

-- 1. Fix 'calls' table: Replace 'SET NULL' with 'CASCADE' for contact_id.
-- This ensures that when a contact is deleted, their associated calls are also removed
ALTER TABLE calls 
DROP CONSTRAINT IF EXISTS calls_contact_id_fkey;

ALTER TABLE calls
ADD CONSTRAINT calls_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) 
ON DELETE CASCADE;

-- 2. Fix 'event_logs' table: Add 'ON DELETE CASCADE' for contact_id.
-- Currently 'NO ACTION' prevents contact deletion if any events exist.
ALTER TABLE event_logs 
DROP CONSTRAINT IF EXISTS event_logs_contact_id_fkey;

ALTER TABLE event_logs
ADD CONSTRAINT event_logs_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) 
ON DELETE CASCADE;

-- 3. Verify 'messages' table cascades properly for both contact and opportunity.
-- Already CASCADE according to SQL check, but re-asserting to be safe.
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_contact_id_fkey,
DROP CONSTRAINT IF EXISTS messages_opportunity_id_fkey;

ALTER TABLE messages
ADD CONSTRAINT messages_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) 
ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT messages_opportunity_id_fkey 
FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) 
ON DELETE CASCADE;

-- 4. Verify 'activities' table cascades properly.
ALTER TABLE activities 
DROP CONSTRAINT IF EXISTS activities_contact_id_fkey;

ALTER TABLE activities
ADD CONSTRAINT activities_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) 
ON DELETE CASCADE;

-- 5. Verify 'opportunities' table cascades properly.
ALTER TABLE opportunities 
DROP CONSTRAINT IF EXISTS opportunities_contact_id_fkey;

ALTER TABLE opportunities
ADD CONSTRAINT opportunities_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) 
ON DELETE CASCADE;
