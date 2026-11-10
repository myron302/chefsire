-- READ-ONLY Part 3b catalog inventory for a disposable PostgreSQL clone / explicitly approved production audit.
-- Returns every foreign key that points at users, including indirect references via ledger tables.
-- No writes, DDL, locks, deletes, or changes to the current database.
--
-- PostgreSQL confdeltype: a=NO ACTION, r=RESTRICT, c=CASCADE, n=SET NULL, d=SET DEFAULT.

WITH RECURSIVE dependencies AS (
  SELECT c.oid AS constraint_oid, c.conrelid, c.confrelid, c.conname,
         c.confdeltype, 1 AS depth, ARRAY[c.confrelid, c.conrelid] AS relation_path
  FROM pg_constraint c
  WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
  UNION ALL
  SELECT c.oid, c.conrelid, c.confrelid, c.conname,
         c.confdeltype, d.depth + 1, d.relation_path || c.conrelid
  FROM pg_constraint c
  JOIN dependencies d ON c.confrelid = d.conrelid
  WHERE c.contype = 'f' AND NOT c.conrelid = ANY(d.relation_path) AND d.depth < 7
)
SELECT d.depth, d.conrelid::regclass::text AS child_table,
       d.confrelid::regclass::text AS parent_table, d.conname AS foreign_key,
       CASE d.confdeltype
         WHEN 'a' THEN 'NO ACTION'
         WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE'
         WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT'
       END AS on_delete,
       pg_get_constraintdef(d.constraint_oid) AS definition,
       array_to_string(d.relation_path::text[], ' → ') AS dependency_path
FROM dependencies d
ORDER BY d.depth, d.conrelid::regclass::text, d.conname;

-- Inventory likely PII / sensitive fields in both ledgers and other dependents.
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~* '(email|phone|name|address|location|token|oauth|secret|password|payment|card|account|bank|tax|refund|dispute|message|detail|metadata|payload|snapshot|attachment|url|bio)'
ORDER BY table_name, ordinal_position;

-- Triggers can act beyond FK delete policies; verify before any erasure.
SELECT event_object_schema AS schema_name, event_object_table AS table_name,
       trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;
