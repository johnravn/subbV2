# Install PostgreSQL Client (psql) on macOS

## Quick Install (Homebrew - Recommended)

```bash
# Install PostgreSQL (includes psql client)
brew install postgresql@17

# Add to PATH (add this to your ~/.zshrc)
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
psql --version
```

## Alternative: Install Just the Client

If you only need psql (not the full PostgreSQL server):

```bash
# Install libpq (PostgreSQL client library)
brew install libpq

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify
psql --version
```

## If You Don't Have Homebrew

1. **Install Homebrew first:**

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Then install PostgreSQL:**
   ```bash
   brew install postgresql@17
   ```

## Verify Installation

```bash
psql --version
# Should show: psql (PostgreSQL) 17.x
```

## Test Connection to Local Supabase

```bash
# Test connection to local database
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "SELECT version();"
```

## After Installation

Once psql is installed, you can use:

- `npm run db:copy-data` - Copy remote data to local
- Direct database queries via psql
- Other database management tasks
