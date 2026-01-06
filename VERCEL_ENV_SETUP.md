# Vercel Environment Variables Setup

## Quick Setup Guide

Add these environment variables in your Vercel project dashboard (Settings > Environment Variables):

### Polymarket API Credentials
```
POLYMARKET_API_KEY=019b9501-82ba-7d71-97a9-9e695237dfc8
POLYMARKET_SECRET=0oCksc_J0cykh0_qb29dLmzxfjp8znUf7iTt9Ih9lXs=
POLYMARKET_PASSPHRASE=294139edd4763608c442fcc5bfe4fe70b6ed6ac142b0301a7680baf48d7c32b0
```

### Vercel AI Gateway
```
VERCEL_AI_GATEWAY_KEY=vck_3ruMO8EXGbLiZA3f5EuJMMupuPy4KVHm3AGxsNDZLJ3z48kfGj4UUzEk
```

### Supabase (from your Vercel Supabase integration)
Get these from your Supabase project settings:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

### Security
```
CRON_SECRET=generate-a-random-secret-string
# Generate with: openssl rand -base64 32
```

### Trading Parameters (Optional - defaults provided)
```
DAILY_BUDGET=100
MIN_ODDS=0.90
MAX_ODDS=0.98
MAX_DAYS_TO_RESOLUTION=2
MIN_LIQUIDITY=10000
INITIAL_BANKROLL=1000
DRY_RUN=true
```

## Important Notes

1. **Set DRY_RUN=true** initially to test without real trades
2. **Set environment for all** (Production, Preview, Development) when adding variables
3. **Redeploy** after adding environment variables for them to take effect
4. **Keep credentials secure** - never commit them to git

## Testing

After setting up environment variables, test the API connection:

```bash
curl https://your-app.vercel.app/api/cron/daily-scan \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

