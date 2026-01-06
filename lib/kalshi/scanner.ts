import { getOrderbookWithLiquidity, calculateDaysToResolution } from './client';
import { getCachedMarkets } from './cache';
import { Contract, ScanCriteria, Market } from '../../types';
import { TRADING_CONSTANTS } from '../../config/constants';

/**
 * Filter-then-Fetch approach for efficient market scanning:
 * 1. Scan all markets and filter for high-conviction (yes price >85¢ or <15¢)
 * 2. Enrich only those candidates with orderbook data for true liquidity
 */
export async function scanContracts(
  criteria: ScanCriteria = {
    minOdds: TRADING_CONSTANTS.MIN_ODDS,
    maxOdds: TRADING_CONSTANTS.MAX_ODDS,
    maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
    minLiquidity: TRADING_CONSTANTS.MIN_LIQUIDITY,
    excludeCategories: TRADING_CONSTANTS.EXCLUDE_CATEGORIES,
    excludeKeywords: TRADING_CONSTANTS.EXCLUDE_KEYWORDS,
  }
): Promise<Contract[]> {
  console.log('🔍 Scanning Kalshi for high-conviction contracts...');
  console.log(`   Criteria: ${criteria.minOdds * 100}%-${criteria.maxOdds * 100}% odds, <${criteria.maxDaysToResolution} days, >$${criteria.minLiquidity} liquidity`);

  // STEP 1: Get markets from cache (refreshed gradually via cron)
  // This avoids hitting rate limits by fetching all markets at once
  const allMarkets = await getCachedMarkets();
  console.log(`   ✅ Retrieved ${allMarkets.length} markets from cache`);
  
  if (allMarkets.length === 0) {
    console.warn('⚠️ No cached markets found. Market refresh cron may not have run yet.');
    return [];
  }

  // STEP 2: Filter for high-conviction markets
  // Keep only markets where yes price is >85 cents OR <15 cents
  // This excludes the middle range (16-84%) where conviction is lower
  const now = new Date();
  const candidates: Market[] = [];

  for (const market of allMarkets) {
    // Filter by price: yes_odds > 0.85 OR < 0.15
    // Convert to cents for comparison
    const yesPriceCents = market.yes_odds * 100;
    
    // Skip if outside our high-conviction range
    if (yesPriceCents < criteria.minOdds * 100 && yesPriceCents > (1 - criteria.maxOdds) * 100) {
      continue;
    }

    // Filter by resolution date
    const daysToResolution = calculateDaysToResolution(market.end_date);
    if (daysToResolution > criteria.maxDaysToResolution || daysToResolution < 0) {
      continue;
    }

    // Exclude resolved markets
    if (market.resolved) {
      continue;
    }

    // Exclude categories (if available in market data)
    if (market.category && criteria.excludeCategories?.includes(market.category)) {
      continue;
    }

    // Exclude contracts with problematic keywords in the question
    const questionLower = market.question.toLowerCase();
    const excludeKeywords = (criteria.excludeKeywords || []).map(k => k.toLowerCase());
    const hasExcludedKeyword = excludeKeywords.some(keyword => questionLower.includes(keyword));
    if (hasExcludedKeyword) {
      continue;
    }

    candidates.push(market);
  }

  console.log(`   📊 Found ${candidates.length} high-conviction candidates after filtering`);

  // STEP 3: Enrich candidates with orderbook data for true liquidity
  // Only fetch orderbook for the filtered candidates (much more efficient)
  const enrichedContracts: Contract[] = [];
  const enrichmentErrors: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const market = candidates[i];
    
    try {
      // Fetch orderbook to get true liquidity (contracts available at best price)
      const { liquidity, side } = await getOrderbookWithLiquidity(market.market_id);
      
      // Filter by minimum liquidity (contracts available, not dollar volume)
      // Convert liquidity (contracts) to approximate dollar value for comparison
      // Each contract is worth $1 at resolution, so liquidity in contracts ≈ liquidity in dollars
      if (liquidity < criteria.minLiquidity) {
        continue;
      }

      // Convert to Contract format
      const contract: Contract = {
        id: '', // Will be set when saved to DB
        market_id: market.market_id,
        question: market.question,
        end_date: market.end_date,
        current_odds: market.yes_odds,
        liquidity: liquidity, // True liquidity from orderbook (contracts available)
        volume_24h: market.volume_24h,
        category: market.category,
        discovered_at: new Date(),
      };

      enrichedContracts.push(contract);

      // Log progress every 10 markets
      if ((i + 1) % 10 === 0 || (i + 1) === candidates.length) {
        console.log(`   📈 Enriched ${i + 1}/${candidates.length} candidates... (${enrichedContracts.length} passed liquidity filter)`);
      }
    } catch (error: any) {
      enrichmentErrors.push(`${market.market_id}: ${error.message}`);
      // Continue with next market even if one fails
      continue;
    }
  }

  if (enrichmentErrors.length > 0) {
    console.warn(`   ⚠️ ${enrichmentErrors.length} markets failed enrichment (likely resolved or inactive)`);
    if (enrichmentErrors.length <= 5) {
      enrichmentErrors.forEach(err => console.warn(`      ${err}`));
    }
  }

  // Sort by liquidity (highest first) - true orderbook depth
  enrichedContracts.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));

  console.log(`   ✅ Found ${enrichedContracts.length} qualifying contracts with sufficient liquidity`);
  return enrichedContracts;
}
