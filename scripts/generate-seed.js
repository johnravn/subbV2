#!/usr/bin/env node
/**
 * Generate seed.sql file from current local database data
 * Usage: node scripts/generate-seed.js
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'

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

try {
  log('🌱 Generating seed file from local database...', 'blue')
  console.log('')

  // Check if local Supabase is running
  try {
    execSync('docker ps | grep supabase_db_grid', { stdio: 'pipe' })
  } catch {
    log('❌ Local Supabase is not running', 'red')
    log('   Run: npm run supabase:start', 'yellow')
    process.exit(1)
  }

  // Use pg_dump to get data - write to temp file first
  log('1️⃣  Dumping data from local database...', 'cyan')
  
  const tempFile = 'supabase/seed.tmp.sql'
  
  // Run pg_dump with larger buffer and write to temp file
  try {
    log('   (This may take a moment for large databases...)', 'yellow')
    const result = execSync(
      `docker exec supabase_db_grid pg_dump -U postgres -d postgres --data-only --column-inserts --no-owner --no-privileges --no-tablespaces`,
      { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      }
    )
    writeFileSync(tempFile, result, 'utf-8')
  } catch (error) {
    log(`❌ Failed to dump database: ${error.message}`, 'red')
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile) } catch {}
    }
    process.exit(1)
  }
  
  // Read the temp file
  log('   Dump completed, processing...', 'cyan')
  const dumpOutput = readFileSync(tempFile, 'utf-8')
  
  // Clean up temp file
  try {
    unlinkSync(tempFile)
  } catch {}

  // Filter out system tables and clean up the dump
  // Only keep pure INSERT INTO ... VALUES statements
  log('2️⃣  Processing dump output...', 'cyan')
  
  const lines = dumpOutput.split('\n')
  const filteredLines = []
  let currentInsert = []
  let inInsert = false
  // Exclude system tables and schemas
  const excludedSchemas = ['_realtime', 'auth', 'storage', 'pg_', 'sql_']
  const excludedTables = new Set([
    'schema_migrations',
    'supabase_migrations',
    'supabase_functions',
    'migrations', // storage.migrations
    'tenants', // _realtime.tenants
    'extensions', // _realtime.extensions
    'audit_log_entries', // auth.audit_log_entries
    'buckets', // storage.buckets (these are created by migrations)
    'objects', // storage.objects (files - too large and sensitive)
  ])

  // Skip lines that indicate DDL statements (functions, triggers, etc.)
  const skipPatterns = [
    /^CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|TRIGGER|VIEW|INDEX|TYPE|TABLE)/i,
    /^DROP\s+(FUNCTION|TRIGGER|VIEW|INDEX|TYPE|TABLE|POLICY)/i,
    /^ALTER\s+(TABLE|FUNCTION|TRIGGER)/i,
    /^\$\$/,
    /^LANGUAGE\s+/i,
    /^SECURITY\s+DEFINER/i,
    /^RETURNS\s+/i,
    /^AS\s+\$\$/i,
    /^BEGIN\s*$/i,
    /^END\s*;?\s*$/i,
    /^RETURN\s+/i,
    /^EXECUTE\s+FUNCTION/i,
    /^FOR\s+EACH\s+ROW/i,
    /^AFTER\s+INSERT/i,
    /^BEFORE\s+/i,
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines, comments (except our table comments), SET statements, and DDL
    if (!line) continue
    
    // Skip DDL statements
    if (skipPatterns.some(pattern => pattern.test(line))) {
      inInsert = false
      currentInsert = []
      continue
    }
    
    // Skip SET, SELECT, and other non-INSERT statements
    if (line.startsWith('SET ') || line.startsWith('SELECT ') || line.startsWith('\\')) {
      continue
    }
    
    // Skip comments except our table markers
    if (line.startsWith('--')) {
      // Only keep our table comments
      if (line.includes('Seed data for')) {
        // Only add if we're starting a new table
        if (currentInsert.length === 0) {
          // Don't add yet, wait for the INSERT statement
        }
      }
      continue
    }

    // Detect INSERT statements
    if (line.toUpperCase().startsWith('INSERT INTO ')) {
      // Finish previous INSERT if any
      if (currentInsert.length > 0) {
        const fullInsert = currentInsert.join(' ')
        if (fullInsert.includes('VALUES') && fullInsert.includes(')') && !fullInsert.match(/VALUES\s*\(\s*\)/)) {
          filteredLines.push(...currentInsert)
        }
        currentInsert = []
      }
      
      const match = line.match(/INSERT INTO (?:([a-z_]+)\.)?(\w+)/i)
      if (match) {
        const schemaName = match[1] || 'public'
        const tableName = match[2]
        
        // Check if schema should be excluded (system schemas)
        const shouldExcludeSchema = excludedSchemas.some(excluded => schemaName.startsWith(excluded))
        
        // Check if table should be excluded
        const shouldExcludeTable = Array.from(excludedTables).some(excluded => tableName.startsWith(excluded) || tableName === excluded)
        
        if (!shouldExcludeSchema && !shouldExcludeTable) {
          inInsert = true
          // Add table comment
          if (filteredLines.length === 0 || !filteredLines[filteredLines.length - 1]?.includes(`-- Seed data for ${tableName}`)) {
            filteredLines.push('')
            filteredLines.push(`-- Seed data for ${schemaName !== 'public' ? `${schemaName}.` : ''}${tableName}`)
          }
          currentInsert.push(line)
        } else {
          inInsert = false
        }
      }
    } else if (inInsert) {
      // Continue INSERT statement (continuation lines)
      // Skip if it looks like DDL or function code
      if (skipPatterns.some(pattern => pattern.test(line)) || 
          line.includes('RETURNING') || 
          line.includes('INTO ') ||
          line.match(/^\s*(CASE|WHEN|THEN|ELSE|END|IF|BEGIN)/i)) {
        // Hit something that's not part of VALUES, stop current INSERT
        currentInsert = []
        inInsert = false
        continue
      }
      
      currentInsert.push(line)
      // End of INSERT statement
      if (line.endsWith(');')) {
        const fullInsert = currentInsert.join(' ')
        // Validate: must have VALUES and complete parentheses, and not contain function keywords
        if (fullInsert.includes('VALUES') && 
            fullInsert.includes('(') && 
            fullInsert.includes(')') &&
            !fullInsert.match(/VALUES\s*\(\s*\)/) &&
            !fullInsert.match(/(RETURNING|INTO\s+\w+|CASE\s+WHEN|BEGIN\s+IF)/i)) {
          filteredLines.push(...currentInsert)
        }
        currentInsert = []
        inInsert = false
      }
    }
  }
  
  // Finish any remaining INSERT
  if (currentInsert.length > 0) {
    const fullInsert = currentInsert.join(' ')
    if (fullInsert.includes('VALUES') && fullInsert.includes(')') && !fullInsert.match(/VALUES\s*\(\s*\)/)) {
      filteredLines.push(...currentInsert)
    }
  }

  // Add header
  const seedContent = `-- Seed file generated from local database
-- Generated: ${new Date().toISOString()}
-- 
-- This file contains initial data that will be loaded after migrations
-- Run: npm run db:reset (this seed file runs automatically)
--
-- Note: This includes ALL data from your local database.
-- For large datasets, consider using db:copy-data instead.

${filteredLines.join('\n')}
`

  // Write to seed.sql
  const seedPath = 'supabase/seed.sql'
  writeFileSync(seedPath, seedContent, 'utf-8')

  log(`\n✅ Seed file created: ${seedPath}`, 'green')
  log(`   Contains data from ${new Set(filteredLines.filter(l => l.startsWith('-- Seed data for')).map(l => l.match(/Seed data for (\w+)/)?.[1]).filter(Boolean)).size} tables`, 'cyan')
  
  const fileSize = (seedContent.length / 1024).toFixed(1)
  log(`   File size: ${fileSize} KB`, 'cyan')
  
  if (parseFloat(fileSize) > 100) {
    log('\n⚠️  Warning: Seed file is quite large (>100KB)', 'yellow')
    log('   Consider if you really want all this data in git', 'yellow')
    log('   You might prefer using db:copy-data for large datasets', 'yellow')
  }

  log('\n📝 Next steps:', 'blue')
  log('   1. Review the seed file: cat supabase/seed.sql | head -50', 'cyan')
  log('   2. Test it: npm run db:reset (seed runs automatically)', 'cyan')
  log('   3. Commit if you want: git add supabase/seed.sql', 'cyan')
  
} catch (error) {
  log(`❌ Error: ${error.message}`, 'red')
  process.exit(1)
}

