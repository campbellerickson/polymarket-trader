# Kalshi Market Screening Strategy

## Overview

The Kalshi Market Screener uses a **4-phase efficient screening strategy** to identify tradeable markets while minimizing API calls and staying within rate limits.

## 4-Phase Strategy

### Phase 1: Bulk Load (1-2 API calls)
- Fetches all open markets from Kalshi API
- Uses pagination to load all ~1000+ markets
- Single API call per page (100 markets per page)
- Total: **1-10 API calls** depending on market count

### Phase 2: Basic Filter (In-Memory, 0 API calls)
Filters markets using data already available from Phase 1:
- **Volume**: Minimum 24h volume (default: 5000 contracts)
- **Open Interest**: Minimum open interest (default: 2000 contracts)
- **Spread**: Maximum bid-ask spread (default: 6 cents)
- **Odds**: High conviction markets (yes >= 85% OR no >= 85%)
- **Question Type**: Simple yes/no questions only (filters out complex markets)
- **Resolution Time**: Markets expiring within 2 days

**Total: 0 API calls** - All filtering happens in-memory

### Phase 3: Rank (In-Memory, 0 API calls)
- Calculates composite liquidity score (0-100) based on:
  - Volume score (0-40 points)
  - Open interest score (0-30 points)
  - Spread score (0-30 points) - tighter spread = higher score
- Sorts markets by liquidity score (descending)
- Assigns ranks to top candidates

**Total: 0 API calls** - All ranking happens in-memory

### Phase 4: Depth Check (30-50 API calls)
- Only checks orderbook depth for top N candidates (default: 40)
- Validates execution quality:
  - Orderbook liquidity at best price
  - Estimated slippage for order size
- Only keeps markets with:
  - Sufficient orderbook liquidity (>= 2000 contracts)
  - Acceptable slippage (< 10%)

**Total: 30-50 API calls** - Only for top candidates

## Total API Usage

**~35-55 API calls per screening run** (well within Kalshi rate limits)

## Usage

### In Code

```typescript
import { KalshiMarketScreener, MarketCriteria } from '../lib/kalshi/screener';

const criteria: MarketCriteria = {
  minVolume24h: 5000,
  minOpenInterest: 2000,
  maxSpreadCents: 6,
  orderSize: 100,
  topNForDepthCheck: 40,
  minOdds: 0.85,
  maxDaysToResolution: 2,
};

const screener = new KalshiMarketScreener();
const markets = await screener.screenMarkets(criteria);
```

### Via API Endpoint

```bash
# Test endpoint
curl -X GET "https://your-deployment.vercel.app/api/test/screen-markets" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Via Cron Job

The screening runs automatically via the `screen-markets` cron job **once daily at 7:30 AM**, before the trading job (8:00 AM) that makes AI trading decisions.

This ensures:
- All eligible markets are screened and cached fresh each morning
- The trading job uses the most up-to-date screened markets
- We stay within rate limits by running comprehensive screening once per day

## Configuration

Environment variables (optional, defaults provided):

```bash
MIN_VOLUME_24H=5000          # Minimum 24h volume in contracts
MIN_OPEN_INTEREST=2000       # Minimum open interest
MAX_SPREAD_CENTS=6           # Maximum bid-ask spread in cents
ORDER_SIZE=100               # Expected order size in contracts
TOP_N_FOR_DEPTH_CHECK=40     # How many top candidates to check orderbook
```

## Output

The screener returns `ScreenedMarket[]` objects with:

- `market_id`: Market identifier
- `question`: Market question
- `yes_odds`: Yes odds (0-1)
- `no_odds`: No odds (0-1)
- `liquidityScore`: Composite liquidity score (0-100)
- `spreadCents`: Bid-ask spread in cents
- `orderbookLiquidity`: Liquidity from orderbook depth check
- `executionSlippage`: Estimated slippage for order size
- `screeningRank`: Overall rank after all phases

## Expected Results

- **20-30 tradeable markets** validated for liquidity and execution quality
- Markets ranked by liquidity score
- All markets meet minimum criteria for volume, spread, and timing
- Execution quality validated via orderbook depth check

## Integration

The screener is integrated into:
1. **Market Refresh Cron** (`/api/cron/refresh-markets`) - Runs every 5 minutes
2. **Trading Cron** (`/api/cron/trading`) - Uses cached screened markets
3. **Test Endpoint** (`/api/test/screen-markets`) - For manual testing

## Benefits

✅ **Efficient**: Only 35-55 API calls per run (vs 1000+ with naive approach)  
✅ **Fast**: In-memory filtering and ranking (no API calls)  
✅ **Reliable**: Stays within rate limits  
✅ **Comprehensive**: Validates execution quality for top candidates  
✅ **Scalable**: Can handle 1000+ markets efficiently  

