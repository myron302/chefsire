-- P2-1: email identity is unique case-insensitively.
--
-- Fails closed: if two accounts already exist for one mailbox in different casing / whitespace, this
-- migration ABORTS (nothing is changed, nothing is merged or deleted) so they are resolved deliberately.
-- Otherwise stored emails are canonicalised (trim + lower-case) and a unique index on lower(email) is created.
-- Idempotent.
DO $$
DECLARE
  dup_count integer;
  dup_sample text;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    SELECT string_agg(k, ', ') INTO dup_sample FROM (
      SELECT lower(btrim(email)) AS k FROM users GROUP BY 1 HAVING count(*) > 1 ORDER BY 1 LIMIT 10
    ) s;
    RAISE EXCEPTION 'users_email_canonical_unique: % email address(es) exist on more than one account differing only by case/whitespace (first: %). No data was changed; resolve these accounts deliberately and re-run.', dup_count, dup_sample;
  END IF;
END
$$;

UPDATE users SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));
