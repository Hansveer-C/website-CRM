-- 🛡️ F1: Prevent multiple active opportunities for the same contact
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_opportunity 
ON opportunities (user_id, contact_id) 
WHERE status = 'open';