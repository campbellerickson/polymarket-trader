# Kalshi Automated Trading System - Architecture Documentation

**Last Updated:** January 2026

Complete technical documentation of the Kalshi Automated Trading System, including data flow, database schema, API endpoints, and decision-making logic.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Decision-Making Process](#decision-making-process)
6. [Trading Metrics & Parameters](#trading-metrics--parameters)
7. [Cron Jobs & Automation](#cron-jobs--automation)
8. [Configuration](#configuration)

---

## System Overview

The Kalshi Automated Trading System is a serverless Next.js application deployed on Vercel that:
- Scans Kalshi prediction markets for high-conviction opportunities
- Uses AI (Claude via Vercel AI Gateway) to analyze and select trades
- Executes trades automatically based on predefined criteria
- Monitors positions for stop-loss triggers
- Generates performance reports and learns from historical trades

### Key Technologies
- **Runtime:** Next.js 14 (Vercel Serverless Functions)
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude via Vercel AI Gateway
- **Trading API:** Kalshi Trade API v2 (using official TypeScript SDK)
- **Authentication:** RSA-PSS signatures (handled by Kalshi SDK)

---

## Data Flow

### 1. Market Discovery Flow

```
Kalshi API → Market Cache → Scanner → Filtered Contracts → AI Analyzer → Trade Executor
```

**Step-by-step:**

1. **Market Refresh Cron** (`refresh-markets`)
   - Runs every 5 minutes
   - Fetches markets from Kalshi API in batches (pagination)
   - Stores in `contracts` table for caching
   - Avoids rate limiting by gradual refresh

2. **Contract Scanner** (`scanContracts`)
   - Reads from cached markets in `contracts` table
   - Filters by:
     - Odds: ≥85% (YES) or ≤2% (NO)
     - Days to resolution: ≤2 days
     - Active markets only (not resolved)
     - Minimum liquidity: ≥$2,000 (from orderbook)
   - Returns list of qualifying contracts

3. **AI Analyzer** (`analyzeContracts`)
   - Receives filtered contracts
   - Builds context including:
     - Historical trade performance
     - Win/loss patterns
     - Reasoning from past trades
     - Current bankroll
   - Sends to Claude AI for analysis
   - AI returns 0-3 contract selections with allocations

4. **Trade Executor** (`executeTrades`)
   - Validates AI selections
   - Checks account balance
   - Places orders via Kalshi API
   - Logs trades to `trades` table

### 2. Decision Information Flow

```
Historical Trades → Learning Module → AI Context → Claude AI → Trade Decisions
```

**Information passed to AI:**

1. **Trade History** (last 50 trades)
   - Win/loss results
   - AI reasoning from each trade
   - Confidence scores
   - Actual outcomes

2. **Performance Patterns**
   - Win rate by confidence level
   - Win rate by odds range
   - Performance by market category
   - Lessons learned from losses

3. **Current Context**
   - Available bankroll
   - Daily budget ($100)
   - Current market conditions
   - Recent trade trends

4. **Contract Details** (for each candidate)
   - Market question/title
   - Current odds
   - Days to resolution
   - Liquidity depth
   - Category/type

### 3. Position Monitoring Flow

```
Open Positions → Stop Loss Monitor → Order Execution → Trade Update
```

1. **Stop Loss Cron** (`stop-loss`)
   - Runs every 2 hours
   - Checks all open positions
   - Calculates current odds via Kalshi API
   - Triggers sell if odds drop below 80%
   - Updates trade status to 'stopped'

2. **Resolution Check** (`check-resolutions`)
   - Runs every 6 hours
   - Checks resolved markets
   - Updates trade outcomes (won/lost)
   - Calculates final P&L

---

## Database Schema

### Core Tables

#### 1. `contracts` - Market Data Cache

**Purpose:** Stores Kalshi market data to avoid excessive API calls

**Key Fields:**
- `market_id` (TEXT, UNIQUE) - Kalshi market ticker
- `question` (TEXT) - Market question
- `current_odds` (DECIMAL) - Current YES odds (0-1)
- `end_date` (TIMESTAMP) - Market expiration
- `liquidity` (DECIMAL) - Available liquidity ($)
- `category` (TEXT) - Market category
- `resolved` (BOOLEAN) - Whether market is closed
- `discovered_at` (TIMESTAMP) - When cached

**Usage:**
- Populated by `refresh-markets` cron (every 5 min)
- Read by `scanContracts()` for filtering
- TTL: ~2 hours (considered stale after)

**Indexes:**
- `market_id` (unique)
- `discovered_at` (for TTL filtering)

---

#### 2. `trades` - Trade History

**Purpose:** Records all executed trades, AI decisions, and outcomes

**Key Fields:**
- `contract_id` (UUID) - Reference to `contracts` table
- `executed_at` (TIMESTAMP) - Trade execution time
- `entry_odds` (DECIMAL) - Odds when entered
- `position_size` (DECIMAL) - Amount invested ($)
- `side` (TEXT) - 'YES' or 'NO'
- `contracts_purchased` (DECIMAL) - Number of contracts
- `ai_confidence` (DECIMAL) - AI confidence (0-1)
- `ai_reasoning` (TEXT) - AI's reasoning for trade
- `risk_factors` (JSONB) - Risk factors identified
- `status` (TEXT) - 'open', 'won', 'lost', 'stopped'
- `exit_odds` (DECIMAL) - Odds when exited (if stopped)
- `pnl` (DECIMAL) - Profit/loss ($)
- `resolved_at` (TIMESTAMP) - When trade resolved

**Usage:**
- Created when trade executed
- Updated by stop-loss and resolution checks
- Read by AI learning module for context

**Indexes:**
- `executed_at` (for date range queries)
- `status` (for open positions)
- `contract_id` (for lookups)

---

#### 3. `ai_decisions` - AI Analysis Log

**Purpose:** Logs every AI analysis run, even if no trades executed

**Key Fields:**
- `run_at` (TIMESTAMP) - When analysis ran
- `contracts_analyzed` (INT) - Number of candidates
- `contracts_selected` (INT) - Number selected by AI
- `total_allocated` (DECIMAL) - Total $ allocated
- `ai_response` (TEXT) - Raw AI response
- `context_used` (JSONB) - Historical context sent to AI

**Usage:**
- Debugging AI decisions
- Understanding AI reasoning patterns
- Performance analysis

---

#### 4. `performance_metrics` - Aggregated Metrics

**Purpose:** Stores daily performance snapshots

**Key Fields:**
- `date` (DATE) - Metric date
- `total_trades` (INT)
- `wins` (INT)
- `losses` (INT)
- `win_rate` (DECIMAL)
- `total_pnl` (DECIMAL)
- `total_return_pct` (DECIMAL)

**Usage:**
- Dashboard display
- Trend analysis
- Performance tracking

---

#### 5. `monthly_analysis` - Monthly Performance Reports

**Purpose:** Monthly breakdown by market type and series ID

**Key Fields:**
- `month_year` (DATE) - First day of month
- `total_trades` (INT)
- `total_invested` (DECIMAL)
- `total_pnl` (DECIMAL)
- `win_rate` (DECIMAL)
- `avg_roi` (DECIMAL)
- `market_type_analysis` (JSONB) - Per-category stats
- `series_analysis` (JSONB) - Per-series stats
- `top_market_types` (JSONB) - Best performers
- `worst_market_types` (JSONB) - Worst performers
- `insights` (TEXT) - Generated insights

**Usage:**
- Monthly performance review
- Identifying profitable market types
- AI learning about what works

**Generated by:** `monthly-analysis` cron (1st of each month)

---

#### 6. `stop_loss_events` - Stop Loss History

**Purpose:** Records all stop-loss triggers

**Key Fields:**
- `trade_id` (UUID) - Reference to trade
- `trigger_odds` (DECIMAL) - Odds when triggered
- `exit_odds` (DECIMAL) - Exit price
- `realized_loss` (DECIMAL) - Loss amount
- `reason` (TEXT) - Why triggered

**Usage:**
- Analyze stop-loss effectiveness
- Identify problematic patterns

---

#### 7. `error_logs` - Error Tracking

**Purpose:** Centralized error logging

**Key Fields:**
- `timestamp` (TIMESTAMP)
- `endpoint` (TEXT) - Where error occurred
- `error_message` (TEXT)
- `stack_trace` (TEXT)
- `context` (JSONB) - Additional context

---

### Supporting Tables

- `daily_reports` - Daily activity reports
- `notification_preferences` - User notification settings
- `stop_loss_config` - Stop-loss configuration

---

## API Endpoints

### Public Dashboard

#### `GET /` - Main Dashboard
- Displays performance metrics
- Shows recent trades
- Monthly analysis charts
- Open positions

#### `GET /logs` - Error Logs
- View system errors
- Debugging interface

### Trading APIs (Protected)

#### `POST /api/cron/daily-scan`
**Schedule:** Daily at 8:00 AM  
**Purpose:** Main trading cycle

**Flow:**
1. Scan for qualifying contracts
2. Run AI analysis
3. Execute trades (up to 3, totaling $100)
4. Log results

**Authentication:** Vercel Cron secret

---

#### `POST /api/cron/stop-loss`
**Schedule:** Every 2 hours  
**Purpose:** Monitor open positions

**Flow:**
1. Fetch all open trades
2. Check current odds for each
3. Trigger sell if odds < 80%
4. Update trade status

---

#### `POST /api/cron/refresh-markets`
**Schedule:** Every 5 minutes  
**Purpose:** Maintain market cache

**Flow:**
1. Fetch one page of markets from Kalshi
2. Upsert into `contracts` table
3. Rotates through all pages over time

---

#### `POST /api/cron/check-resolutions`
**Schedule:** Every 6 hours  
**Purpose:** Update resolved trades

**Flow:**
1. Check resolved markets
2. Update trade outcomes
3. Calculate final P&L

---

#### `POST /api/cron/monthly-analysis`
**Schedule:** 1st of each month at midnight  
**Purpose:** Generate monthly report

**Flow:**
1. Aggregate trades from previous month
2. Calculate stats by market type
3. Generate insights
4. Save to `monthly_analysis` table

---

### Test/Diagnostic APIs

#### `GET /api/test/kalshi`
**Purpose:** Test Kalshi API integration  
**Tests:**
- Account balance fetch
- Market fetching
- Orderbook retrieval
- Authentication

---

#### `GET /api/test/ai`
**Purpose:** Test AI analysis without executing trades  
**Returns:**
- Contract candidates
- AI selections
- Reasoning
- Allocations

---

#### `GET /api/test/qualifying-contracts`
**Purpose:** Show detailed breakdown of qualifying contracts  
**Returns:**
- Count at each filtering stage
- Sample contracts
- Breakdown by odds/days
- Current criteria

---

#### `GET /api/migrate`
**Purpose:** Check migration status  
**Returns:**
- SQL if table missing
- Migration instructions

---

### Data APIs

#### `GET /api/dashboard`
**Purpose:** Dashboard data endpoint  
**Returns:**
- Current bankroll
- Total P&L
- Win rate
- Recent trades
- Open positions
- Monthly analyses

---

#### `GET /api/logs`
**Purpose:** Error logs  
**Returns:**
- Recent errors
- Stack traces
- Context

---

## Decision-Making Process

### 1. Contract Selection Criteria

**Tier 1: Initial Filter (in Scanner)**
- Odds: ≥85% (YES) OR ≤2% (NO)
- Days to resolution: ≤2 days
- Active markets only
- Valid odds (not 0/null)

**Tier 2: Liquidity Check**
- Orderbook depth: ≥$2,000
- Can actually enter/exit position

**Tier 3: AI Analysis**
- Contract quality assessment
- Risk evaluation
- Historical pattern matching
- Diversification check

### 2. AI Decision Factors

**Inputs to AI:**
1. **Contract Details**
   - Question clarity
   - Resolution criteria
   - Time to resolution
   - Liquidity depth

2. **Historical Performance**
   - Past trade results
   - Win rate by type
   - What worked/didn't work
   - Reasoning patterns that led to wins/losses

3. **Risk Assessment**
   - Information asymmetry risk
   - Black swan potential
   - Market manipulation risk
   - Correlation with other positions

4. **Allocation Logic**
   - Higher conviction = larger allocation ($20-$50)
   - Maximum 3 contracts
   - Total ≤ $100
   - Diversify across uncorrelated events

**AI Output:**
```json
{
  "selected_contracts": [
    {
      "market_id": "...",
      "allocation": 35,
      "confidence": 0.92,
      "reasoning": "...",
      "risk_factors": ["..."]
    }
  ],
  "total_allocated": 100,
  "strategy_notes": "..."
}
```

### 3. Trade Execution Rules

**Before Execution:**
- Check account balance (must have funds)
- Validate AI selections (0-3 contracts)
- Verify allocations sum ≤ daily budget
- Check circuit breakers (loss streaks, etc.)

**Order Placement:**
- Market orders (immediate execution)
- Calculate contracts from allocation / odds
- Log all trades immediately

**After Execution:**
- Update bankroll
- Log trade with AI reasoning
- Monitor for stop-loss

---

## Trading Metrics & Parameters

### Core Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `DAILY_BUDGET` | $100 | Maximum daily investment |
| `MIN_ODDS` | 0.85 (85%) | Minimum odds for YES side |
| `MAX_ODDS` | 0.98 (98%) | Maximum odds (reduces risk) |
| `MAX_DAYS_TO_RESOLUTION` | 2 | Only trade contracts expiring soon |
| `MIN_LIQUIDITY` | $2,000 | Minimum orderbook depth |
| `MIN_POSITION_SIZE` | $20 | Minimum per contract |
| `MAX_POSITION_SIZE` | $50 | Maximum per contract |
| `STOP_LOSS_THRESHOLD` | 0.80 (80%) | Sell if odds drop below |
| `MAX_LOSSES_IN_STREAK` | 5 | Circuit breaker trigger |
| `MAX_STOP_LOSSES_24H` | 3 | Daily stop-loss limit |

### Decision Metrics

**Win Rate Calculation:**
```
win_rate = (wins) / (wins + losses)
```

**Return on Investment (ROI):**
```
roi = (total_pnl / total_invested) * 100
```

**Unrealized P&L:**
```
unrealized_pnl = (current_odds * contracts) - position_size
```

**Confidence Accuracy:**
- Compare AI confidence to actual outcome
- Track if high confidence = high win rate

---

## Cron Jobs & Automation

### Schedule Overview

| Cron | Schedule | Purpose |
|------|----------|---------|
| `refresh-markets` | Every 5 min | Maintain market cache |
| `daily-scan` | Daily 8:00 AM | Main trading cycle |
| `stop-loss` | Every 2 hours | Monitor positions |
| `check-resolutions` | Every 6 hours | Update resolved trades |
| `monthly-analysis` | 1st of month | Generate monthly report |
| `morning-report` | Daily 7:00 AM | Daily activity report |

### Automation Flow

```
Daily Cycle:
  7:00 AM → Morning Report Generated
  8:00 AM → Daily Scan (AI analysis + trades)
  
Continuous:
  Every 5 min → Market Cache Refresh
  Every 2 hours → Stop Loss Check
  Every 6 hours → Resolution Check
  
Monthly:
  1st of month → Monthly Analysis Generated
```

---

## Configuration

### Environment Variables

**Kalshi API:**
- `KALSHI_API_ID` - API key ID
- `KALSHI_PRIVATE_KEY` - RSA private key (PEM)

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL` - Database URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

**AI:**
- `VERCEL_AI_GATEWAY_KEY` - Vercel AI Gateway key
- `ANTHROPIC_API_KEY` - (if not using gateway)

**Security:**
- `CRON_SECRET` - Secret for cron authentication

**Trading:**
- `DAILY_BUDGET` - Daily investment limit (default: 100)
- `MIN_ODDS` - Minimum odds (default: 0.85)
- `MIN_LIQUIDITY` - Minimum liquidity (default: 2000)
- `DRY_RUN` - Test mode (default: false)

---

## How Components Interact

```
┌─────────────────┐
│  Kalshi API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Market Cache    │◄─────│ refresh-     │
│ (contracts)     │      │ markets      │
└────────┬────────┘      │ cron         │
         │               └──────────────┘
         ▼
┌─────────────────┐      ┌──────────────┐
│ Contract        │◄─────│ daily-scan   │
│ Scanner         │      │ cron         │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ AI Analyzer     │◄─────│ Learning     │
│                 │      │ Module       │
└────────┬────────┘      └──────┬───────┘
         │                      │
         │              ┌───────▼───────┐
         │              │ Historical    │
         │              │ Trades        │
         │              └───────────────┘
         ▼
┌─────────────────┐
│ Trade Executor  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Trades Table    │◄─────│ stop-loss    │
│                 │      │ cron         │
└─────────────────┘      └──────────────┘
```

---

## Important Notes

### Rate Limiting
- Kalshi API rate limits: ~500ms between requests
- Market cache reduces API calls significantly
- Gradual refresh spreads load over time

### Error Handling
- All errors logged to `error_logs` table
- Failures don't crash the system
- Trades validated before execution

### Learning System
- AI receives historical performance
- Identifies winning patterns
- Avoids repeating mistakes
- Adapts based on results

---

## Troubleshooting

### Common Issues

**No qualifying contracts found:**
- Check market cache is populated
- Verify filtering criteria aren't too strict
- Check Kalshi API connectivity

**Authentication errors:**
- Verify KALSHI_PRIVATE_KEY format (PEM with newlines)
- Check KALSHI_API_ID matches
- SDK handles signing automatically

**Dashboard errors:**
- Check database migrations ran
- Verify Supabase credentials
- Check error logs in `/api/logs`

---

**End of Documentation**

