import { fetchMarkets } from './client';
import { Contract, ScanCriteria } from '../../types';
import { TRADING_CONSTANTS } from '../../config/constants';

export async function scanContracts(
  criteria: ScanCriteria = {
    minOdds: TRADING_CONSTANTS.MIN_ODDS,
    maxOdds: TRADING_CONSTANTS.MAX_ODDS,
    maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
    minLiquidity: TRADING_CONSTANTS.MIN_LIQUIDITY,
    excludeCategories: TRADING_CONSTANTS.EXCLUDE_CATEGORIES,
  }
): Promise<Contract[]> {
  console.log('🔍 Scanning Kalshi for contracts...');
  console.log(`   Criteria: ${criteria.minOdds * 100}%-${criteria.maxOdds * 100}% odds, <${criteria.maxDaysToResolution} days, >$${criteria.minLiquidity} liquidity`);

  // Fetch all active markets
  const markets = await fetchMarkets();
  console.log(`   Found ${markets.length} total markets`);

  const now = new Date();
  const qualifying: Contract[] = [];

  for (const market of markets) {
    // Filter by resolution date
    const daysToResolution = (market.end_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysToResolution > criteria.maxDaysToResolution || daysToResolution < 0) {
      continue;
    }

    // Filter by odds (we want high probability YES contracts)
    // Note: market.current_odds is already set from client transformation
    if (market.current_odds < criteria.minOdds || market.current_odds > criteria.maxOdds) {
      continue;
    }

    // Filter by liquidity
    if (market.liquidity < criteria.minLiquidity) {
      continue;
    }

    // Exclude resolved markets
    if (market.resolved) {
      continue;
    }

    // Exclude categories
    // Note: This assumes market has a category field - adjust based on actual API
    // if (market.category && criteria.excludeCategories.includes(market.category)) {
    //   continue;
    // }

    // Convert to Contract format
    const contract: Contract = {
      id: '', // Will be set when saved to DB
      market_id: market.market_id,
      question: market.question,
      end_date: market.end_date,
      current_odds: market.current_odds,
      liquidity: market.liquidity,
      volume_24h: market.volume_24h,
      discovered_at: new Date(),
    };

    qualifying.push(contract);
  }

  // Sort by volume/liquidity (highest first)
  qualifying.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));

  console.log(`   ✅ Found ${qualifying.length} qualifying contracts`);
  return qualifying;
}

