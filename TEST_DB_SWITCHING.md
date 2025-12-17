# Testing Database Switching

## Quick Test Steps

### 1. Check Current Status

```bash
npm run db:switch:status
```

Should show which database you're currently using.

### 2. Test Switching to Local

```bash
# Switch to local
npm run db:switch:local

# Verify the switch
npm run db:switch:status
# Should show: "Current: LOCAL database"

# Check the actual .env.local file
cat .env.local | grep VITE_SUPABASE_URL
# Should show: VITE_SUPABASE_URL=http://127.0.0.1:54321
```

### 3. Test Switching to Remote

```bash
# Switch to remote
npm run db:switch:remote

# Verify the switch
npm run db:switch:status
# Should show: "Current: REMOTE database"

# Check the actual .env.local file
cat .env.local | grep VITE_SUPABASE_URL
# Should show: VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
```

### 4. Test with Your App

#### Test Local Database:

```bash
# Make sure local Supabase is running
npm run supabase:start

# Switch to local
npm run db:switch:local

# Start your app
npm run dev

# In your browser console, check:
# - Open DevTools → Console
# - Your app should connect to http://127.0.0.1:54321
# - Check network requests to verify
```

#### Test Remote Database:

```bash
# Switch to remote
npm run db:switch:remote

# Restart your app (if running)
# Ctrl+C to stop, then:
npm run dev

# In your browser console:
# - Your app should connect to https://tlpgejkglrgoljgvpubn.supabase.co
# - Check network requests to verify
```

## Verification Checklist

- [ ] `npm run db:switch:status` shows correct database
- [ ] `.env.local` has correct `VITE_SUPABASE_URL`
- [ ] `.env.local` has correct `VITE_SUPABASE_ANON_KEY`
- [ ] App connects to the right database (check browser network tab)
- [ ] Other env variables (like Google Maps key) are preserved

## Troubleshooting

### "Cannot connect to database"

- **Local:** Make sure `npm run supabase:start` is running
- **Remote:** Check your internet connection and that the key is correct

### "Wrong database"

- Check `.env.local` manually: `cat .env.local`
- Verify the URL matches what you expect
- Try switching again: `npm run db:switch:local` or `npm run db:switch:remote`

### "Other env variables missing"

- The script should preserve them, but if not, check `.env.local` and add them back
- They should be in the file after switching

## Quick Test Script

Run this to test everything at once:

```bash
# Test 1: Status check
echo "=== Test 1: Status ==="
npm run db:switch:status

# Test 2: Switch to local
echo -e "\n=== Test 2: Switch to Local ==="
npm run db:switch:local
npm run db:switch:status
cat .env.local | grep VITE_SUPABASE_URL

# Test 3: Switch to remote
echo -e "\n=== Test 3: Switch to Remote ==="
npm run db:switch:remote
npm run db:switch:status
cat .env.local | grep VITE_SUPABASE_URL

echo -e "\n✅ All tests complete!"
```
