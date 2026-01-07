import { getOrderbookWithLiquidity, calculateDaysToResolution } from './client';
import { getCachedMarkets } from './cache';
import { Contract, ScanCriteria, Market } from '../../types';
import { TRADING_CONSTANTS } from '../../config/constants';

/**
 * Check if a market has a simple yes/no question (not multiple questions)
 * Filters out markets with multiple yes clauses or multiple no clauses
 */
function isSimpleYesNoMarket(question: string): boolean {
  if (!question || question.length === 0) {
    return false;
  }

  const questionLower = question.toLowerCase().trim();
  
  // Count occurrences of "yes" clauses (pattern: "yes" followed by text, possibly comma-separated)
  // Match patterns like "yes X", "yes X:", "yes X,", "yes X: Y"
  const yesMatches = questionLower.match(/\byes\s+[^,]+/gi) || [];
  
  // Count occurrences of "no" clauses (pattern: "no" followed by text, possibly comma-separated)
  // Match patterns like "no X", "no X:", "no X,", "no X: Y"
  const noMatches = questionLower.match(/\bno\s+[^,]+/gi) || [];
  
  // Filter out if there's more than one yes clause OR more than one no clause
  if (yesMatches.length > 1 || noMatches.length > 1) {
    return false;
  }
  
  // If it passes, it's a simple yes/no market (0-1 yes clauses, 0-1 no clauses)
  return true;
}

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
    // Skip markets with invalid/zero odds for both yes and no
    const hasValidYesOdds = market.yes_odds && market.yes_odds > 0 && market.yes_odds !== null;
    const hasValidNoOdds = market.no_odds && market.no_odds > 0 && market.no_odds !== null;
    
    if (!hasValidYesOdds && !hasValidNoOdds) {
      continue;
    }

    // Filter by price: check both yes_odds AND no_odds
    // High conviction means:
    // - yes_odds >= minOdds (e.g., 85%) - we'd buy YES
    // - OR no_odds >= minOdds (e.g., 85%) - we'd buy NO
    const yesPricePercent = (market.yes_odds || 0) * 100;
    const noPricePercent = (market.no_odds || (1 - (market.yes_odds || 0))) * 100;
    
    const isHighYes = yesPricePercent >= criteria.minOdds * 100; // >= 85% (or minOdds%)
    const isHighNo = noPricePercent >= criteria.minOdds * 100; // >= 85% (or minOdds%)
    
    // Also check for very low odds (high confidence in opposite direction)
    const isVeryLowYes = yesPricePercent <= (1 - criteria.maxOdds) * 100; // <= 2% (100% - 98%)
    const isVeryLowNo = noPricePercent <= (1 - criteria.maxOdds) * 100; // <= 2%
    
    // Keep if either side has high conviction
    if (!isHighYes && !isHighNo && !isVeryLowYes && !isVeryLowNo) {
      continue;
    }

    // Filter by resolution date - ensure end_date exists and is a Date
    if (!market.end_date) {
      continue;
    }
    
    let endDate: Date;
    try {
      // Handle both Date objects and string dates from database
      if (market.end_date instanceof Date) {
        endDate = market.end_date;
      } else if (typeof market.end_date === 'string') {
        endDate = new Date(market.end_date);
        if (isNaN(endDate.getTime())) {
          continue; // Invalid date, skip
        }
      } else {
        continue; // Invalid type, skip
      }
    } catch (e) {
      continue; // Error parsing date, skip
    }

    const daysToResolution = calculateDaysToResolution(endDate);
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

    // Only include simple yes/no markets (exclude complex multi-question markets)
    if (!isSimpleYesNoMarket(market.question)) {
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
        yes_odds: market.yes_odds,
        no_odds: market.no_odds || (1 - market.yes_odds),
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
