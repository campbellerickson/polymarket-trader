# Project Structure

This document describes the organization of the Kalshi Automated Trading System codebase.

## Directory Structure

```
kalshi-trader/
├── config/              # Configuration files
│   ├── constants.ts     # Trading constants and parameters
│   └── env.ts          # Environment variable validation
│
├── lib/                 # Core library code
│   ├── ai/             # AI analysis and learning
│   │   ├── analyzer.ts # Main AI analysis logic
│   │   ├── learning.ts # Historical learning context
│   │   └── prompts.ts  # AI system prompts
│   │
│   ├── analysis/       # Performance analysis
│   │   └── monthly.ts  # Monthly analysis generation
│   │
│   ├── backtest/       # Backtesting framework
│   │   ├── data-loader.ts
│   │   ├── engine.ts
│   │   ├── runner.ts
│   │   └── types.ts
│   │
│   ├── database/       # Database layer
│   │   ├── client.ts   # Supabase client
│   │   ├── queries.ts  # Database queries
│   │   └── migrations/ # SQL migration files
│   │
│   ├── kalshi/         # Kalshi API integration
│   │   ├── cache.ts    # Market data caching
│   │   ├── client.ts   # Kalshi SDK wrapper
│   │   ├── executor.ts # Trade execution
│   │   ├── resolver.ts # Market resolution
│   │   └── scanner.ts  # Contract scanning
│   │
│   ├── notifications/  # Notification system
│   │   ├── email.ts
│   │   ├── report.ts
│   │   └── sms.ts
│   │
│   ├── trading/        # Trading logic
│   │   └── stop-loss.ts # Stop-loss monitoring
│   │
│   └── utils/          # Utility functions
│       ├── kelly.ts    # Kelly Criterion
│       ├── logger.ts   # Logging utilities
│       ├── metrics.ts  # Performance metrics
│       └── notifications.ts
│
├── pages/              # Next.js pages and API routes
│   ├── api/           # API endpoints
│   │   ├── cron/      # Cron job handlers
│   │   ├── test/      # Test/diagnostic endpoints
│   │   ├── analysis/  # Analysis endpoints
│   │   ├── dashboard.ts
│   │   ├── logs.ts
│   │   └── migrate.ts
│   │
│   ├── index.tsx      # Main dashboard
│   ├── logs.tsx       # Logs viewer
│   └── docs.tsx       # Documentation viewer
│
├── public/            # Static files
│   └── docs/          # Documentation files
│
├── docs/              # Documentation
│   └── ARCHITECTURE.md # System architecture docs
│
├── scripts/           # Utility scripts
│   └── run-supabase-migration.sh
│
├── types/             # TypeScript type definitions
│   └── index.ts
│
├── styles/            # Global styles
│   └── globals.css
│
└── Root files
    ├── package.json
    ├── tsconfig.json
    ├── vercel.json    # Vercel configuration
    ├── vercel-build.sh
    ├── README.md
    ├── SETUP_GUIDE.md
    ├── MIGRATIONS_COMPLETE.sql
    ├── RUN_MIGRATION.sql
    └── PROJECT_STRUCTURE.md (this file)
```

## File Categories

### Configuration
- `config/constants.ts` - Trading parameters (odds, liquidity, budget)
- `config/env.ts` - Environment variable schema
- `vercel.json` - Vercel deployment config
- `package.json` - Dependencies and scripts

### Core Logic
- `lib/kalshi/*` - Kalshi API integration
- `lib/ai/*` - AI analysis and learning
- `lib/database/*` - Database operations
- `lib/trading/*` - Trading strategies

### API Endpoints
- `pages/api/cron/*` - Scheduled jobs
- `pages/api/test/*` - Testing/diagnostics
- `pages/api/*` - Data endpoints

### Frontend
- `pages/index.tsx` - Dashboard
- `pages/logs.tsx` - Error logs viewer
- `pages/docs.tsx` - Documentation viewer
- `styles/globals.css` - Global styles

### Database
- `lib/database/migrations/*` - SQL migrations
- `MIGRATIONS_COMPLETE.sql` - Complete schema
- `RUN_MIGRATION.sql` - Quick migration

### Documentation
- `docs/ARCHITECTURE.md` - Complete system docs
- `README.md` - Getting started
- `SETUP_GUIDE.md` - Setup instructions

## Key Files Explained

### Entry Points
- **`pages/api/cron/trading.ts`** - Main trading cycle
- **`pages/index.tsx`** - Dashboard UI
- **`lib/kalshi/scanner.ts`** - Contract discovery

### Core Logic
- **`lib/ai/analyzer.ts`** - AI contract selection
- **`lib/kalshi/executor.ts`** - Trade execution
- **`lib/trading/stop-loss.ts`** - Risk management

### Data Flow
1. Market data → `lib/kalshi/cache.ts`
2. Contract filtering → `lib/kalshi/scanner.ts`
3. AI analysis → `lib/ai/analyzer.ts`
4. Trade execution → `lib/kalshi/executor.ts`
5. Database logging → `lib/database/queries.ts`

## Cleanup Notes

### Files to Keep
- All files in `lib/`, `pages/`, `config/`, `types/`, `styles/`
- `docs/ARCHITECTURE.md`
- `README.md`, `SETUP_GUIDE.md`
- `MIGRATIONS_COMPLETE.sql`, `RUN_MIGRATION.sql`
- `vercel.json`, `package.json`, `tsconfig.json`

### Files to Review
- Old migration files (keep for history)
- Test scripts (useful for debugging)
- Checklists (can be archived)

### Deprecated/Unused
- Old `api/` directory (migrated to `pages/api/`)
- Unused notification files (if not implemented)

