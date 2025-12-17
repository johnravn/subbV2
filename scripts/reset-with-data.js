#!/usr/bin/env node
/**
 * Reset local database and populate with data from remote
 * This is a convenience script that combines db:reset + db:copy-data
 * Usage: node scripts/reset-with-data.js
 */

import { execSync } from 'child_process'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function resetWithData() {
  log('🔄 Resetting local database and populating with remote data...', 'blue')
  console.log('')

  try {
    // Step 1: Reset database (applies migrations + seed file)
    log('1️⃣  Resetting local database...', 'cyan')
    log('   (This applies migrations and runs seed.sql)', 'cyan')
    execSync('npm run db:reset', { stdio: 'inherit' })
    log('   ✅ Database reset complete', 'green')
    console.log('')

    // Step 2: Copy auth users from remote
    log('2️⃣  Copying authentication users from remote...', 'cyan')
    try {
      execSync('npm run db:copy-auth', { stdio: 'inherit' })
      log('   ✅ Auth users copied', 'green')
    } catch (error) {
      log('   ⚠️  Auth copy had issues (continuing anyway)', 'yellow')
      log('   You can run: npm run db:copy-auth later', 'cyan')
    }
    console.log('')

    // Step 3: Copy data from remote
    log('3️⃣  Copying data from remote database...', 'cyan')
    execSync('npm run db:copy-data', { stdio: 'inherit' })
    log('   ✅ Data copy complete', 'green')
    console.log('')

    // Step 4: Sync storage buckets (already done in db:reset, but just in case)
    log('4️⃣  Verifying storage buckets...', 'cyan')
    execSync('npm run db:sync-buckets', { stdio: 'inherit' })
    log('   ✅ Buckets synced', 'green')
    console.log('')

    // Step 5: Copy storage files (actual files in buckets)
    log('5️⃣  Copying storage files from remote...', 'cyan')
    log('   (This may take a while if you have many files)', 'yellow')
    try {
      execSync('npm run db:copy-storage', { stdio: 'inherit' })
      log('   ✅ Storage files copied', 'green')
    } catch (error) {
      log('   ⚠️  Storage copy had issues (this is optional)', 'yellow')
      log('   You can run: npm run db:copy-storage later', 'cyan')
    }
    console.log('')

    log('✅ Local database is now reset and fully populated!', 'green')
    console.log('')
    log('💡 What was included:', 'blue')
    log('   ✅ Database schema (migrations)', 'green')
    log('   ✅ Authentication users (can log in locally)', 'green')
    log('   ✅ Database data (all tables)', 'green')
    log('   ✅ Storage bucket definitions', 'green')
    log('   ✅ Storage files (images, PDFs, etc.)', 'green')
    console.log('')
    log('💡 Next steps:', 'blue')
    log('   - Your local DB now has all data from remote', 'cyan')
    log('   - You can start developing: npm run dev', 'cyan')
    log('   - To refresh data later: npm run db:copy-data', 'cyan')
    log('   - To refresh files: npm run db:copy-storage', 'cyan')
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red')
    process.exit(1)
  }
}

resetWithData().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red')
  process.exit(1)
})

