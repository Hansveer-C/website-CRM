-- Production already has idx_page_sections_page_id on the same column.
drop index if exists public.page_sections_page_id_idx;
