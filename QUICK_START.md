# Quick Start

## Daily Startup

```bash
npm run supabase:start      # Start Supabase (Docker)
npm run db:switch:local     # Switch to local DB
npm run dev                 # Start Vite dev server
```

## URLs

- **App:** http://localhost:3000
- **Supabase Studio:** http://127.0.0.1:54323
- **API:** http://127.0.0.1:54321

## Get Local Keys

```bash
npm run db:status  # Shows "Publishable" key
```

## Switch DB

```bash
npm run db:switch:local   # Local
npm run db:switch:remote  # Remote
```

## Stop

```bash
Ctrl+C                    # Stop dev server
npm run supabase:stop     # Stop Supabase
```
