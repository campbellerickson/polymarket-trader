# Database Migration Guide

## Current Schema Status

✅ **All required fields for AI learning are already present:**
- `trades.ai_reasoning` (TEXT) - Stores AI reasoning for each trade
- `trades.ai_confidence` (DECIMAL) - Stores AI confidence score (0-1)
- `trades.risk_factors` (JSONB) - **NEW**: Stores risk factors identified by AI (optional)

## Migration Files Created

### 1. `MIGRATIONS_COMPLETE.sql`
**Complete schema with all tables and indexes** - Idempotent (safe to run multiple times)

### 2. `lib/database/migrations/002_enhance_ai_learning.sql`
**Enhancement migration** - Adds `risk_factors` field and ensures all AI learning fields exist

## Running Migrations

### Option 1: Manual (Recommended for Supabase)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project
2. Navigate to **SQL Editor**
3. Open `MIGRATIONS_COMPLETE.sql`
4. Copy and paste the entire SQL into the editor
5. Click **Run** or press `Cmd/Ctrl + Enter`

### Option 2: Using Script (if you have psql installed)
```bash
SUPABASE_URL="postgres://..." SUPABASE_SERVICE_ROLE_KEY="..." \
  ./scripts/run-supabase-migration.sh MIGRATIONS_COMPLETE.sql
```

### Option 3: Programmatic (for CI/CD)
```bash
node scripts/apply-migrations-supabase.js
```
Note: This will output SQL for manual execution as Supabase doesn't support direct SQL execution via REST API.

## What the Migrations Do

1. **Creates all required tables** (if they don't exist)
   - `contracts` - Cached market data
   - `trades` - Trade records with AI reasoning
   - `ai_decisions` - Detailed AI decision snapshots
   - `performance_metrics` - Performance tracking
   - `stop_loss_events`, `stop_loss_config` - Stop loss system
   - `error_logs` - Error tracking
   - `daily_reports`, `notification_preferences` - Reporting

2. **Adds AI learning enhancements**
   - `trades.risk_factors` (JSONB) - Store AI-identified risk factors
   - Ensures `ai_reasoning` is TEXT type (for full reasoning storage)
   - Ensures `ai_confidence` exists

3. **Creates performance indexes**
   - Indexes on `ai_confidence` for pattern analysis
   - Full-text search index on `ai_reasoning` for keyword analysis
   - Indexes on `discovered_at` for cache freshness queries

4. **Adds constraints and validation**
   - CHECK constraints on status fields
   - Foreign key relationships
   - Default values

## Verification

After running migrations, verify in Supabase Dashboard:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if risk_factors column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'trades' 
  AND column_name IN ('ai_reasoning', 'ai_confidence', 'risk_factors');

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE '%ai%' OR indexname LIKE '%trades%';
```

## Auto-Run on Deployment

To automatically run migrations on Vercel deployment, add a build hook:

1. Create a Supabase Edge Function or webhook
2. Or use Vercel's build command to run migrations
3. Or manually run after each deployment (simplest)

**Recommended**: Run migrations manually once after deployment, then they're set.

## Notes

- All migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` - safe to run multiple times
- The `risk_factors` field is optional - existing code will work without it
- All AI learning features work with existing schema, `risk_factors` is just an enhancement

