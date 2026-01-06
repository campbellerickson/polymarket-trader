# Kalshi Trader - Setup Guide

This guide will walk you through setting up the Kalshi Automated Trading System from scratch.

## Prerequisites

- Node.js 18+ installed
- A GitHub account
- A Vercel account (free tier works)
- A Supabase account (free tier works)
- API keys for the services below

## Step 1: Clone and Initialize

```bash
cd /Users/campbellerickson/Desktop/Code/kalshi-trader
npm install
```

## Step 2: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once your project is ready, go to the SQL Editor
3. Copy and paste the contents of `lib/database/migrations/001_initial_schema.sql`
4. Run the migration
5. Note your project URL and anon key from Settings > API

## Step 3: Get API Keys

### Kalshi API

1. Go to [Kalshi](https://kalshi.com)
2. Create an account and complete KYC if required
3. Navigate to Account Settings > API Keys
4. Click "Create New API Key" to generate:
   - **API Key ID**: Displayed on screen (starts with format like `id-...`)
   - **Private Key**: Downloaded as a `.key` file (RSA private key in PEM format)
5. Save both securely - the private key cannot be retrieved later

**Note**: Kalshi provides both production and demo environments. Start with demo for testing.

### Vercel AI Gateway

1. Go to your Vercel project dashboard
2. Navigate to the "AI Gateway" section
3. Create a new API key in the "API Keys" section
4. Copy the key (starts with `vck_`)
5. This key provides access to Claude and other AI models through Vercel's gateway

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Kalshi API
KALSHI_API_ID=your_kalshi_api_id_here
KALSHI_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nYour private key content here\n-----END RSA PRIVATE KEY-----
# Note: For multi-line private key, use \n for newlines or keep as single line

# Vercel AI Gateway
VERCEL_AI_GATEWAY_KEY=vck_your-vercel-ai-gateway-key-here

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key-here

# Security
CRON_SECRET=generate-a-random-secret-string-here
# You can generate one with: openssl rand -base64 32

# Trading Parameters
DAILY_BUDGET=100
MIN_ODDS=0.90
MAX_ODDS=0.98
MAX_DAYS_TO_RESOLUTION=2
MIN_LIQUIDITY=10000
INITIAL_BANKROLL=1000

# Safety Features
DRY_RUN=true
# Set to false when ready to trade with real money
```

## Step 5: Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Link your project: `vercel link`
4. Add all environment variables to Vercel:

```bash
vercel env add KALSHI_API_ID
vercel env add KALSHI_PRIVATE_KEY
vercel env add VERCEL_AI_GATEWAY_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_KEY
vercel env add CRON_SECRET
# ... add all other environment variables
```

5. Deploy: `vercel --prod`

## Step 6: Configure Cron Jobs

Vercel will automatically set up cron jobs based on `vercel.json`. Verify they're active in your Vercel dashboard under Settings > Cron Jobs.

## Step 7: Test the System

### Test Daily Scan (Dry Run)

```bash
curl https://your-app.vercel.app/api/cron/daily-scan \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Morning Report

```bash
curl https://your-app.vercel.app/api/cron/morning-report \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Stop Loss Monitor

```bash
curl https://your-app.vercel.app/api/cron/stop-loss \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Step 8: Enable Live Trading

Once you've tested everything in dry run mode:

1. Update the `DRY_RUN` environment variable in Vercel to `false`
2. Ensure you have sufficient funds in your Kalshi account
3. Monitor the first few trades closely

## Step 9: Set Up Backtesting (Optional)

### Load Historical Data

You can backtest against historical Kalshi data. Create a JSON file with historical market data:

```json
[
  {
    "market_id": "market-123",
    "question": "Will X happen?",
    "end_date": "2024-01-15T00:00:00Z",
    "historical_odds": [
      {
        "timestamp": "2024-01-10T00:00:00Z",
        "yes_odds": 0.95,
        "no_odds": 0.05,
        "liquidity": 50000,
        "volume_24h": 10000
      }
    ],
    "resolved": true,
    "outcome": "YES",
    "resolved_at": "2024-01-15T00:00:00Z"
  }
]
```

Save as `historical-data.json` and update `lib/backtest/data-loader.ts` to load from this file.

### Run Backtest

```bash
npm run backtest 2024-01-01 2024-12-31 1000 true
```

## Troubleshooting

### Database Connection Issues

- Verify your Supabase URL and key are correct
- Check that the migration ran successfully
- Ensure your Supabase project is active

### API Errors

- Verify all API keys are correct
- Check API rate limits
- Ensure Kalshi API access is approved

### Cron Jobs Not Running

- Check Vercel cron job configuration
- Verify CRON_SECRET matches in environment variables
- Check Vercel logs for errors

### Reports Not Generating

- Check Vercel logs for errors
- Verify database connection
- Check that cron jobs are running

## Security Notes

- **Never commit `.env` file to git**
- **Use strong, random CRON_SECRET**
- **Keep API keys secure**
- **Start with DRY_RUN=true**
- **Monitor first trades closely**
- **Set up circuit breakers**

## Support

For issues or questions:
1. Check the logs in Vercel dashboard
2. Review database for error records
3. Test individual components manually

## Next Steps

- Set up monitoring dashboard
- Configure additional alerting
- Fine-tune trading parameters
- Add more sophisticated risk management
- Implement additional backtesting strategies

