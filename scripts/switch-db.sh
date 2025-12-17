#!/bin/bash
# Script to switch between local and remote Supabase databases

set -e

ENV_FILE=".env.local"
LOCAL_ENV=".env.local.db"
REMOTE_ENV=".env.remote.db"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to show current database
show_current() {
    if [ -f "$ENV_FILE" ]; then
        if grep -q "127.0.0.1:54321" "$ENV_FILE"; then
            echo -e "${BLUE}Current: ${GREEN}LOCAL${NC}"
        elif grep -q "supabase.co" "$ENV_FILE"; then
            echo -e "${BLUE}Current: ${GREEN}REMOTE${NC}"
        else
            echo -e "${YELLOW}Current: Unknown${NC}"
        fi
    else
        echo -e "${YELLOW}No .env.local file found${NC}"
    fi
}

# Function to switch to local
switch_to_local() {
    if [ ! -f "$LOCAL_ENV" ]; then
        echo -e "${YELLOW}Creating $LOCAL_ENV template...${NC}"
        cat > "$LOCAL_ENV" << EOF
# Local Supabase Configuration
# Get these values from: npm run db:status

VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_LOCAL_ANON_KEY
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
EOF
        echo -e "${YELLOW}Please update $LOCAL_ENV with your local anon key from 'npm run db:status'${NC}"
    fi
    
    cp "$LOCAL_ENV" "$ENV_FILE"
    echo -e "${GREEN}✓ Switched to LOCAL database${NC}"
    echo -e "${BLUE}Make sure Supabase is running: npm run supabase:start${NC}"
}

# Function to switch to remote
switch_to_remote() {
    if [ ! -f "$REMOTE_ENV" ]; then
        echo -e "${YELLOW}Creating $REMOTE_ENV template...${NC}"
        cat > "$REMOTE_ENV" << EOF
# Remote Supabase Configuration
# Get these from: https://app.supabase.com/project/tlpgejkglrgoljgvpubn/settings/api

VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_REMOTE_ANON_KEY
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
EOF
        echo -e "${YELLOW}Please update $REMOTE_ENV with your remote anon key${NC}"
    fi
    
    cp "$REMOTE_ENV" "$ENV_FILE"
    echo -e "${GREEN}✓ Switched to REMOTE database${NC}"
}

# Main logic
case "$1" in
    local)
        switch_to_local
        ;;
    remote)
        switch_to_remote
        ;;
    status|current)
        show_current
        ;;
    *)
        echo "Usage: $0 {local|remote|status}"
        echo ""
        echo "Commands:"
        echo "  local   - Switch to local Supabase database"
        echo "  remote  - Switch to remote Supabase database"
        echo "  status  - Show current database configuration"
        echo ""
        show_current
        exit 1
        ;;
esac

