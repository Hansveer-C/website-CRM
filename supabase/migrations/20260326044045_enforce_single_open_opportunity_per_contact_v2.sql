-- PARTIAL UNIQUE INDEX: Allow multiple closed opportunities, but strictly one 'open' one.
CREATE UNIQUE INDEX IF NOT EXISTS unique_open_opportunity_per_contact 
ON opportunities (user_id, contact_id) 
WHERE (status = 'open');