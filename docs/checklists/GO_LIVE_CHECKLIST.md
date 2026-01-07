# 🚀 Go Live Checklist - Kalshi Trader

This checklist covers everything needed to deploy your Kalshi trading system to production.

## ✅ Pre-Deployment Checklist

### 1. Supabase Database Setup

- [ ] **Create Supabase Project** (if not already done)
  - Go to [supabase.com](https://supabase.com)
  - Create new project
  - Note your project URL and anon key

- [ ] **Run Database Migration**
  - Go to Supabase Dashboard → SQL Editor
  - Copy contents of `lib/database/migrations/001_initial_schema.sql`
  - Paste and run the migration
  - Verify tables were created (should see: contracts, trades, ai_decisions, performance_metrics, notification_preferences, daily_reports, stop_loss_events, stop_loss_config)

- [ ] **Get Supabase Credentials**
  - Settings → API
  - Copy `SUPABASE_URL` (e.g., `https://xxxxx.supabase.co`)
  - Copy `SUPABASE_KEY` (anon/public key)

### 2. Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

#### Required Variables:

- [ ] **KALSHI_API_ID**
  - Value: `9064b32b-a1d8-414a-8a56-f02d140696c9`
  - Environment: All (Production, Preview, Development)

- [ ] **KALSHI_PRIVATE_KEY**
  - Value: Your full RSA private key (with BEGIN/END markers)
  - Format: `-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEAwF1lwM2tHhZyRRCLlPkRTIuyNTdIDLNlphOR/G7QoKxmyJOR\n...\n-----END RSA PRIVATE KEY-----`
  - Environment: All
  - ⚠️ **Important**: Replace actual newlines with `\n` or paste as single line

- [ ] **VERCEL_AI_GATEWAY_KEY**
  - Value: `vck_3ruMO8EXGbLiZA3f5EuJMMupuPy4KVHm3AGxsNDZLJ3z48kfGj4UUzEk`
  - Environment: All

- [ ] **SUPABASE_URL**
  - Value: Your Supabase project URL
  - Environment: All

- [ ] **SUPABASE_KEY**
  - Value: Your Supabase anon key
  - Environment: All

- [ ] **CRON_SECRET**
  - Generate with: `openssl rand -base64 32`
  - Or use: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
  - Environment: All
  - ⚠️ **Keep this secret!** Used to authenticate cron job requests

#### Optional Trading Parameters (defaults provided):

- [ ] **DAILY_BUDGET** (default: 100)
- [ ] **MIN_ODDS** (default: 0.90)
- [ ] **MAX_ODDS** (default: 0.98)
- [ ] **MAX_DAYS_TO_RESOLUTION** (default: 2)
- [ ] **MIN_LIQUIDITY** (default: 10000)
- [ ] **INITIAL_BANKROLL** (default: 1000)

#### Safety Settings:

- [ ] **DRY_RUN** (default: true)
  - ⚠️ **CRITICAL**: Keep as `true` for initial testing!
  - Set to `false` only after thorough testing

### 3. Deploy to Vercel

- [ ] **Link Repository** (if not already linked)
  ```bash
  cd /Users/campbellerickson/Desktop/Code/kalshi-trader
  vercel link
  ```

- [ ] **Deploy**
  ```bash
  vercel --prod
  ```

- [ ] **Verify Deployment**
  - Check Vercel dashboard for successful deployment
  - Note your app URL (e.g., `https://kalshi-trader.vercel.app`)

### 4. Verify Cron Jobs

- [ ] **Check Cron Configuration**
  - Vercel Dashboard → Settings → Cron Jobs
  - Verify 4 cron jobs are configured:
    - `morning-report` (12:00 UTC / 7 AM ET)
    - `daily-scan` (16:00 UTC / 11 AM ET)
    - `stop-loss` (Every 2 hours)
    - `check-resolutions` (Every 6 hours)

### 5. Initial Testing (DRY_RUN=true)

- [ ] **Test Daily Scan**
  ```bash
  curl https://your-app.vercel.app/api/cron/daily-scan \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
  - Should return success response
  - Check Vercel logs for any errors
  - Verify it's scanning Kalshi markets (but not placing real orders)

- [ ] **Test Morning Report**
  ```bash
  curl https://your-app.vercel.app/api/cron/morning-report \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
  - Should generate and log daily report
  - Check logs for report content

- [ ] **Test Stop Loss Monitor**
  ```bash
  curl https://your-app.vercel.app/api/cron/stop-loss \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
  - Should check for stop loss conditions
  - Should log results

- [ ] **Verify Database Logging**
  - Go to Supabase Dashboard → Table Editor
  - Check that tables are being populated:
    - `contracts` table (after daily scan)
    - `trades` table (after trades are executed)
    - `daily_reports` table (after morning report)

### 6. Verify API Connections

- [ ] **Kalshi API Connection**
  - Check Vercel logs after running daily-scan
  - Should see successful market fetching
  - If errors, verify KALSHI_API_ID and KALSHI_PRIVATE_KEY are correct

- [ ] **Vercel AI Gateway Connection**
  - Check logs during AI analysis
  - Should see successful Claude API calls
  - If errors, verify VERCEL_AI_GATEWAY_KEY

- [ ] **Supabase Connection**
  - Check logs for database operations
  - Should see successful queries
  - If errors, verify SUPABASE_URL and SUPABASE_KEY

### 7. Pre-Production Checklist

Before setting `DRY_RUN=false`:

- [ ] **Review Trading Parameters**
  - Daily budget is appropriate
  - Odds range (90-98%) is correct
  - Stop loss threshold (80%) is acceptable
  - Minimum liquidity requirements are set

- [ ] **Verify Kalshi Account**
  - Account is funded
  - API keys are for production (not demo)
  - Account has sufficient balance for daily budget

- [ ] **Monitor for 24-48 hours in DRY_RUN**
  - Watch logs for any errors
  - Verify all cron jobs run successfully
  - Check that AI analysis is working
  - Ensure database is logging correctly

### 8. Go Live (Set DRY_RUN=false)

- [ ] **Update DRY_RUN Environment Variable**
  - Vercel Dashboard → Environment Variables
  - Change `DRY_RUN` from `true` to `false`
  - Redeploy: `vercel --prod`

- [ ] **Monitor First Real Trade**
  - Watch Vercel logs closely
  - Verify order is placed on Kalshi
  - Check Kalshi dashboard for order confirmation
  - Verify trade is logged in database

- [ ] **Set Up Monitoring**
  - Check Vercel logs daily
  - Monitor Supabase for data consistency
  - Set up alerts for errors (if possible)

## 🔧 Troubleshooting

### Common Issues:

1. **"Missing or invalid environment variables"**
   - Check all required env vars are set in Vercel
   - Verify no typos in variable names
   - Ensure values are correct

2. **"Kalshi API error: 401 Unauthorized"**
   - Verify KALSHI_API_ID is correct
   - Check KALSHI_PRIVATE_KEY format (newlines as `\n`)
   - Ensure private key includes BEGIN/END markers

3. **"Database connection error"**
   - Verify SUPABASE_URL and SUPABASE_KEY
   - Check Supabase project is active
   - Ensure migration was run

4. **"Cron job returns 401"**
   - Verify CRON_SECRET matches in Authorization header
   - Check CRON_SECRET is set in Vercel

5. **"AI Gateway error"**
   - Verify VERCEL_AI_GATEWAY_KEY is correct
   - Check AI Gateway is enabled in Vercel project

## 📞 Support Resources

- **Kalshi API Docs**: https://docs.kalshi.com
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs

## ✅ Final Checklist

- [ ] All environment variables set
- [ ] Database migration complete
- [ ] Deployed to Vercel
- [ ] Cron jobs configured
- [ ] Tested in DRY_RUN mode
- [ ] All API connections verified
- [ ] Monitored for 24-48 hours
- [ ] Ready to set DRY_RUN=false
- [ ] First real trade monitored

---

**🎉 Once all items are checked, you're ready to go live!**

