# Kalshi Automated Trading System

An automated trading system for Kalshi prediction markets using AI analysis (Claude) to identify and execute high-probability trades.

## Features

- 🤖 **AI-Powered Analysis**: Uses Claude Sonnet 4.5 to analyze contracts and make trading decisions
- 📊 **Automated Scanning**: Daily scans for high-probability contracts (90-98% odds)
- 💰 **Smart Position Sizing**: Kelly criterion-based position sizing
- 🛡️ **Stop Loss Protection**: Automatic stop loss at 80% odds threshold
- 📈 **Performance Tracking**: Comprehensive metrics and daily reports
- 📱 **Daily Reports**: SMS/Email reports with MTD/YTD performance
- 🧪 **Backtesting**: Test strategies against historical data

## Architecture

```
Vercel Cron Jobs
    ↓
Contract Scanner → AI Analyzer → Trade Executor
    ↓                                    ↓
Database Logger ← Performance Monitor
```

## Tech Stack

- **Runtime**: Vercel Serverless Functions (Node.js/TypeScript)
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API
- **Notifications**: Twilio (SMS) + SendGrid (Email)
- **APIs**: Kalshi Trade API

## Setup

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed setup instructions.

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see SETUP_GUIDE.md)
4. Run database migrations
5. Deploy to Vercel: `vercel --prod`

## Backtesting

Run backtests against historical data:

```bash
npm run backtest [start-date] [end-date] [initial-bankroll] [use-ai]
```

Example:
```bash
npm run backtest 2024-01-01 2024-12-31 1000 true
```

## Cron Jobs

- **Morning Report**: 7 AM ET daily
- **Daily Scan**: 11 AM ET daily
- **Stop Loss Check**: Every 2 hours
- **Resolution Check**: Every 6 hours

## License

MIT

