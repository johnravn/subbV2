#!/bin/bash
# Copy data from remote Supabase database to local database
# Usage: ./scripts/copy-remote-data.sh

set -e

echo "📥 Copying data from remote to local database..."

# Check if local Supabase is running
if ! docker ps | grep -q supabase_db_grid; then
    echo "❌ Local Supabase is not running. Start it with: npm run supabase:start"
    exit 1
fi

# Dump data from remote (data only, no schema)
echo "1️⃣  Dumping data from remote database..."
npx supabase db dump --data-only --linked > /tmp/remote_data.sql

# Check if dump was successful
if [ ! -s /tmp/remote_data.sql ]; then
    echo "❌ Failed to dump remote data. Make sure you're linked: npm run supabase:link"
    exit 1
fi

# Restore to local database
echo "2️⃣  Restoring data to local database..."
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f /tmp/remote_data.sql

echo "✅ Data copied successfully!"
echo ""
echo "💡 Tip: You can run this script anytime to refresh local data:"
echo "   ./scripts/copy-remote-data.sh"

