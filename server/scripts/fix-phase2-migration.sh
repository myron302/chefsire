#!/bin/bash
# Fix Phase 2 migration by cleaning up partial tables and re-running migrations

set -e  # Exit on any error

echo "🧹 Cleaning up partial Phase 2 tables..."
psql "$DATABASE_URL" < server/drizzle/cleanup_phase2.sql

echo ""
echo "🚀 Running Phase 2 migration..."
psql "$DATABASE_URL" < server/drizzle/0002_phase2_social_explosion.sql

echo ""
echo "🚀 Running Phase 3 migration..."
psql "$DATABASE_URL" < server/drizzle/0003_phase3_power_user.sql

echo ""
echo "✅ Migrations completed successfully!"
