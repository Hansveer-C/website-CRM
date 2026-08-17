ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS trigger_event_id TEXT;
ALTER TABLE public.messages ADD CONSTRAINT messages_trigger_event_id_unique UNIQUE (trigger_event_id);
