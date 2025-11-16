#!/bin/bash
# Verify Migration Sync
# This script compares local migration files with remote database

echo "📋 Local Migration Files:"
echo "=========================="
find supabase/migrations -name "*.sql" -type f | \
  grep -E '[0-9]{14}' | \
  sed 's|supabase/migrations/||' | \
  sed 's|\.sql||' | \
  sort | \
  while read migration; do
    version=$(echo "$migration" | cut -d'_' -f1)
    name=$(echo "$migration" | cut -d'_' -f2-)
    echo "  $version - $name"
  done

echo ""
echo "✅ To check remote migrations, run verify_migrations_sync.sql in Supabase SQL Editor"
echo "   Or run: npx supabase migration list --linked (if CLI is working)"

