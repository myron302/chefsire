#!/bin/bash
# DISABLED (Stability Phase 3B): this ran cleanup_phase2.sql (DROP TABLE … CASCADE) directly against $DATABASE_URL.
# The SQL is quarantined in server/migration-quarantine/. See docs/stability-phase-3b-migration-safety.md.
echo "fix-phase2-migration.sh is disabled; see docs/stability-phase-3b-migration-safety.md" >&2
exit 1
