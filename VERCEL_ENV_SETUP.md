# Vercel Environment Variables Setup

## Quick Setup Guide

Add these environment variables in your Vercel project dashboard (Settings > Environment Variables):

### Kalshi API Credentials
```
KALSHI_API_ID=9064b32b-a1d8-414a-8a56-f02d140696c9
KALSHI_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEAwF1lwM2tHhZyRRCLlPkRTIuyNTdIDLNlphOR/G7QoKxmyJOR\n4muBxAX4+fzRUJe04+Ur1Hr7s4NX3iLBeXH4L3x/qCWEIq/a/2dbDjdXvG4tvLNC\nJF8TBqjiDdO0eOpJC9ffLqNmdQwcSXKwqq4Or7Yg6d5oQlsurg1xWjrH+8tgpAXE\nwvNivuticWd2xaGGfG185666GGZJxnOQS8SL7FCweHq7nyzCEZDurYrSIZ/00qpN\n2Qit+80Wet+krN47LlW9mp5+qsJqtjS1NByCHBtN1y6MHJ0/gA04nFCuwDZZbiXN\ngqOxL1xt6CnwF+4VRF/uY0RHyZ/KR6xEotnFfwIDAQABAoIBAFE/IVrtg9DRajIB\navLgv4208u/HCYdTvfsHCQG1TCiQqFjO+y7GeWhxnVb4kO+ZI62dfYWg6+5F6zbH\nNzA0Er77tm8uaUC9RaHZ5Xt7pHLRlj+89pKmFUMa0V9Fq1PmoDOAWaM5IG0PUGM1\nLajpGwrbwcsFRMPB/1VEGDwj15Ng9w4SJRjo/37DMpErwUUKAM5zbqnXsm/qsAiz\nu1aTUwCst7nbmYrzIIHJLKgTfwhQWq8udb9W2J0nRLeNZ8Om1LFjGK0NUsFiiWg6\n+MYpvT3rYkax8iphkh9AR2ipwyhVaLoenxKDj18oeDm3S1Wq5C52h+Pw/9xUTMzg\nuDEXQgECgYEA0aaivz2tiozUcNxi/5Zen6xuxlIqcEmU2bYIDwowqycRl8Lni2AK\nbLDLRng3oyQyYY1r7KNdarfBCglT0O4WeLUmFnEF8W6iqMftZgDyR/o7dKWJa+YD\nz1ODgxryJDa5gFZC79vraJsHbhYF/sbjQ/wfUt+r5Y+Bf2CYOon0z1cCgYEA6uRx\nDNEz3JAtkmR/Haa47t9+S8UbQlav/tSaOm2KBeAuTCT4hWu0uYNPJFluDLK0k5Ib\naV5k5nKDTPjs6AIfbspaeSPq1CCzCu6ItLOV7DnEUqnpQt+zz3am8mOdeFEHfheF\ntA8qzNh6Er3fPBKvuHvMF0YaRbEzhE6JfHd06hkCgYB7csGWFn1fffmB02O/2A0z\nvFcmFC/FGq65W4R3RqrNvR2Q3UV2PkElKx0nC5bHS4MXCi0olDFnq3fRrxhZiDhX\nL2OUB01WkqzY8ZCKZbhERcZIs0it7i0EIcrooi8+v7KPLTwQ/NArMk43tmQlV3tv\nBsBzDh2r+Mpp9Ljuj1lF1QKBgASQBWYjVieNoWT7kMCJsYPqUXC1Vm82cdq4VHqY\nEBtHHH8cJLuquOr1kv74wbt7aSiIqQGl9L3JMaW4HBnxmJy1T4aU3QXb0L6AnaUs\n69eX06lrZX2IDN0Vx+5jYvaoVEXtvQofVUx/U/ezOnfXQRSLSw6UrQP3ijGiuObz\nBxFZAoGAEfxUCwcd6Y9diON2K+ibhF4HrJFTfJjW/c0bjyb/YeVwW63frdJenPDl\nQetxmwnGXrXO+WRnA88HzSI7tCzJ4spgskgXsxdpT5J9+LWRfGmWNGGppzGvO8+/\nUZMm71bUdJTVX6CMzTknpJorsGHekBUIs6wN/A/A6DmvM9lCPdY=\n-----END RSA PRIVATE KEY-----
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

