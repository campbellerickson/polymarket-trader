# Kalshi Automated Trading System

An automated trading system for Kalshi prediction markets using AI analysis (Claude) to identify and execute high-probability trades.

## Features

- 🤖 **AI-Powered Analysis**: Uses Claude via Vercel AI Gateway to analyze contracts and make trading decisions
- 📊 **Automated Scanning**: Daily scans for high-probiction contracts (85-98% odds)
- 💰 **Smart Position Sizing**: Allocates up to $100/day across 1-3 contracts
- 🛡️ **Stop Loss Protection**: Automatic stop loss at 80% odds threshold
- 📈 **Performance Tracking**: Comprehensive metrics, monthly analysis, and learning system
- 🔄 **Market Caching**: Efficient market data caching to avoid rate limits
- 📱 **Dashboard**: Real-time performance dashboard and documentation viewer

## Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/campbellerickson/kalshi-trader.git
   cd kalshi-trader
   npm install
   ```

2. **Set Up Environment Variables**
   - See `SETUP_GUIDE.md` for complete list
   - Required: Kalshi API keys, Supabase credentials, Vercel AI Gateway key

3. **Run Database Migrations**
   - Copy `RUN_MIGRATION.sql` to Supabase Dashboard → SQL Editor
   - Or run `MIGRATIONS_COMPLETE.sql` for full schema

4. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## Documentation

- **[Architecture Docs](./docs/ARCHITECTURE.md)** - Complete system documentation
- **[Setup Guide](./SETUP_GUIDE.md)** - Detailed setup instructions
- **[Project Structure](./PROJECT_STRUCTURE.md)** - Codebase organization
- **[View Docs in Dashboard](https://your-app.vercel.app/docs)** - Interactive documentation viewer

## Tech Stack

- **Runtime**: Next.js 14 (Vercel Serverless Functions)
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude via Vercel AI Gateway
- **Trading API**: Kalshi Trade API v2 (official TypeScript SDK)
- **Authentication**: RSA-PSS signatures (handled by SDK)

## Project Structure

```
kalshi-trader/
├── config/          # Configuration (constants, env)
├── lib/             # Core logic
│   ├── ai/         # AI analysis & learning
│   ├── kalshi/     # Kalshi API integration
│   ├── database/   # Database layer
│   └── trading/    # Trading logic
├── pages/          # Next.js pages & API routes
├── docs/           # Documentation
└── scripts/        # Utility scripts
```

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for details.

## API Endpoints

### Trading (Protected)
- `POST /api/cron/daily-scan` - Main trading cycle (daily at 8 AM)
- `POST /api/cron/stop-loss` - Monitor positions (every 2 hours)
- `POST /api/cron/refresh-markets` - Market cache refresh (every 5 min)

### Testing
- `GET /api/test/kalshi` - Test Kalshi API integration
- `GET /api/test/ai` - Test AI analysis
- `GET /api/test/qualifying-contracts` - Show qualifying contracts breakdown

### Dashboard
- `GET /api/dashboard` - Dashboard data
- `GET /api/logs` - Error logs

## Trading Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| Daily Budget | $100 | Maximum daily investment |
| Min Odds | 85% | Minimum odds for YES side |
| Max Odds | 98% | Maximum odds (risk limit) |
| Max Days to Resolution | 2 | Only trade contracts expiring soon |
| Min Liquidity | $2,000 | Minimum orderbook depth |
| Stop Loss Threshold | 80% | Sell if odds drop below |

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## License

MIT
