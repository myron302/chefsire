-- Phase 2M catering customer inquiry lifecycle: structured customer contact details.
--
-- ADDITIVE ONLY. Two nullable columns on catering_inquiries. Inquiries created before this migration keep NULL in
-- both: their contact details, where the customer gave any, live inside the free-text message and are deliberately
-- NOT parsed back out, so no historical value is fabricated. No other table, constraint or index is touched.
ALTER TABLE catering_inquiries ADD COLUMN IF NOT EXISTS customer_email varchar(254);
ALTER TABLE catering_inquiries ADD COLUMN IF NOT EXISTS customer_phone varchar(32);
