-- Applied to production (Neon project plain-shadow-90987980, branch "production") on 2026-11-09, approved by Myron
-- ("add phone"). Backup branch taken first: backup-before-phone-20261109 (br-misty-scene-afk3id7n).
-- Additive only: a nullable column, a format check and a partial unique index. 20 users, none with a phone yet.
-- Applied BEFORE the code that reads users.phone, because Drizzle selects every users column.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(16);
ALTER TABLE users ADD CONSTRAINT users_phone_e164_check CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$');
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users (phone) WHERE phone IS NOT NULL;
COMMIT;

-- Verified afterwards:
--   users.phone: character varying(16), nullable
--   users_phone_unique: CREATE UNIQUE INDEX ... ON public.users USING btree (phone) WHERE (phone IS NOT NULL)
--   users_phone_e164_check: CHECK (((phone IS NULL) OR ((phone)::text ~ '^\+[1-9][0-9]{7,14}$'::text)))
--   users: 20, with phone: 0; live site (old code) still served products, profiles and login normally.
-- Rollback (only if needed, before any phone is stored):
--   DROP INDEX users_phone_unique; ALTER TABLE users DROP CONSTRAINT users_phone_e164_check; ALTER TABLE users DROP COLUMN phone;
