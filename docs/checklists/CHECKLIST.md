# Pre-Launch Checklist

## ✅ Environment Variables in Vercel

Verify you have all these variables set in Vercel:

### Required Variables:
- [ ] `KALSHI_API_ID` - Your Kalshi API ID (9064b32b-a1d8-414a-8a56-f02d140696c9)
- [ ] `KALSHI_PRIVATE_KEY` - Your RSA private key (full key with BEGIN/END lines)
- [ ] `VERCEL_AI_GATEWAY_KEY` - Your Vercel AI Gateway key (vck_3ruMO8EXGbLiZA3f5EuJMMupuPy4KVHm3AGxsNDZLJ3z48kfGj4UUzEk)
- [ ] `SUPABASE_URL` - ✅ Already set (https://dseoabejewthjyyxmdwp.supabase.co)
- [ ] `SUPABASE_KEY` - Use `SUPABASE_SERVICE_ROLE_KEY` value (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZW9hYmVqZXd0aGp5eXhtZHdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcyMDk1NSwiZXhwIjoyMDgzMjk2OTU1fQ.NB5A3J5Ni_trYMI2RwqrVa_W9IYawj9hfOAYsZy-JFU)
- [ ] `CRON_SECRET` - Generate a random secret (use: `openssl rand -base64 32`)

### Optional Trading Parameters (with defaults):
- [ ] `DAILY_BUDGET` - Default: 100
- [ ] `MIN_ODDS` - Default: 0.90
- [ ] `MAX_ODDS` - Default: 0.98
- [ ] `MAX_DAYS_TO_RESOLUTION` - Default: 2
- [ ] `MIN_LIQUIDITY` - Default: 10000
- [ ] `DRY_RUN` - Set to `true` for testing, `false` for live trading
- [ ] `INITIAL_BANKROLL` - Default: 1000

## ✅ Database Setup

1. [ ] Go to Supabase SQL Editor: https://supabase.com/dashboard/project/dseoabejewthjyyxmdwp/sql
2. [ ] Copy contents of `lib/database/migrations/001_initial_schema.sql`
3. [ ] Paste and run the migration
4. [ ] Verify tables are created:
   - contracts
   - trades
   - ai_decisions
   - performance_metrics
   - notification_preferences
   - daily_reports
   - stop_loss_events
   - stop_loss_config
   - error_logs

## ✅ Vercel Deployment

1. [ ] Push latest code to GitHub (already done ✅)
2. [ ] Vercel should auto-deploy from GitHub
3. [ ] Check deployment logs for any errors
4. [ ] Verify cron jobs are configured in Vercel dashboard

## ✅ Testing

1. [ ] Visit dashboard: `https://your-project.vercel.app`
2. [ ] Check that dashboard loads (may be empty initially)
3. [ ] Visit logs page: `https://your-project.vercel.app/logs`
4. [ ] Manually trigger a cron job to test (optional):
   - Go to Vercel Functions
   - Find `/api/cron/daily-scan`
   - Click "Invoke" to test

## ⚠️ Important Notes

- **DRY_RUN Mode**: Keep `DRY_RUN=true` until you're ready to trade with real money
- **Cron Secret**: Make sure `CRON_SECRET` is set and matches what Vercel uses for cron authentication
- **Database Migration**: Must be run before the system can function
- **Initial Bankroll**: Set `INITIAL_BANKROLL` to your starting capital amount

## 🚀 Once Everything is Checked

1. Set `DRY_RUN=false` when ready
2. Monitor first few trades closely
3. Check dashboard daily for performance
4. Review error logs if issues occur

