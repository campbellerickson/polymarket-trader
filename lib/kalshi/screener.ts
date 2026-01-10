import { Market } from '../../types';
import { getMarketApi, getOrderbookWithLiquidity, calculateDaysToResolution, sleep } from './client';
import { TRADING_CONSTANTS } from '../../config/constants';
import { MarketApi } from 'kalshi-typescript';

/**
 * Market screening criteria
 */
export interface MarketCriteria {
  minVolume24h?: number; // Minimum 24h volume in contracts
  minOpenInterest?: number; // Minimum open interest
  maxSpreadCents?: number; // Maximum bid-ask spread in cents
  orderSize?: number; // Expected order size in contracts
  topNForDepthCheck?: number; // How many top candidates to check orderbook for
  minOdds?: number; // Minimum odds for high conviction (default from TRADING_CONSTANTS)
  maxDaysToResolution?: number; // Maximum days until resolution
}

/**
 * Enhanced market with screening metadata
 */
export interface ScreenedMarket extends Market {
  liquidityScore: number; // Composite liquidity score (0-100)
  spreadCents: number; // Bid-ask spread in cents
  orderbookLiquidity?: number; // Liquidity from orderbook depth check
  executionSlippage?: number; // Estimated slippage for order size
  screeningRank?: number; // Overall rank after all phases
}

/**
 * Check if a market has a simple yes/no question (not multiple questions)
 */
function isSimpleYesNoMarket(question: string): boolean {
  if (!question || question.length === 0) {
    return false;
  }

  const questionLower = question.toLowerCase().trim();
  
  // Count occurrences of "yes" clauses
  const yesMatches = questionLower.match(/\byes\s+[^,]+/gi) || [];
  
  // Count occurrences of "no" clauses
  const noMatches = questionLower.match(/\bno\s+[^,]+/gi) || [];
  
  // Filter out if there's more than one yes clause OR more than one no clause
  if (yesMatches.length > 1 || noMatches.length > 1) {
    return false;
  }
  
  return true;
}

/**
 * Calculate bid-ask spread in cents from market data
 */
function calculateSpreadCents(market: any): number {
  // Extract bid and ask prices (in cents or dollars)
  let yesBid = 0;
  let yesAsk = 0;
  
  if (typeof market.yes_bid === 'number') {
    yesBid = market.yes_bid; // Already in cents (0-100)
  } else if (typeof market.yes_bid_dollars === 'string') {
    yesBid = parseFloat(market.yes_bid_dollars) * 100; // Convert dollars to cents
  } else if (typeof market.yes_bid_dollars === 'number') {
    yesBid = market.yes_bid_dollars * 100;
  }
  
  if (typeof market.yes_ask === 'number') {
    yesAsk = market.yes_ask; // Already in cents (0-100)
  } else if (typeof market.yes_ask_dollars === 'string') {
    yesAsk = parseFloat(market.yes_ask_dollars) * 100;
  } else if (typeof market.yes_ask_dollars === 'number') {
    yesAsk = market.yes_ask_dollars * 100;
  }
  
  // If ask is 0, use bid as proxy (or vice versa)
  if (yesAsk === 0 && yesBid > 0) {
    yesAsk = yesBid + 1; // Estimate: ask is slightly above bid
  }
  if (yesBid === 0 && yesAsk > 0) {
    yesBid = Math.max(0, yesAsk - 1); // Estimate: bid is slightly below ask
  }
  
  return yesAsk - yesBid; // Spread in cents
}

/**
 * Calculate composite liquidity score (0-100)
 * Higher score = better liquidity
 */
function calculateLiquidityScore(
  volume24h: number,
  openInterest: number,
  spreadCents: number,
  minVolume: number,
  minOpenInterest: number,
  maxSpread?: number // Optional - if not provided, spread is not considered
): number {
  // Volume score (0-50 points if no spread, otherwise 0-40)
  const volumePoints = maxSpread !== undefined ? 40 : 50;
  const volumeScore = Math.min(volumePoints, (volume24h / minVolume) * volumePoints);
  
  // Open interest score (0-50 points if no spread, otherwise 0-30)
  const openInterestPoints = maxSpread !== undefined ? 30 : 50;
  const openInterestScore = Math.min(openInterestPoints, (openInterest / minOpenInterest) * openInterestPoints);
  
  // Spread score (0-20 points) - only if maxSpread is provided
  let spreadScore = 0;
  if (maxSpread !== undefined && maxSpread > 0) {
    const spreadNormalized = Math.min(1, spreadCents / maxSpread);
    spreadScore = (1 - spreadNormalized) * 20;
  }
  
  return volumeScore + openInterestScore + spreadScore;
}

/**
 * Kalshi Market Screener
 * Implements 4-phase efficient screening strategy
 */
export class KalshiMarketScreener {
  private marketApi: MarketApi;
  
  constructor() {
    this.marketApi = getMarketApi();
  }

  /**
   * PHASE 1: Bulk Load - Fetch ONLY open markets (up to 4,000 markets)
   * Uses status='open' filter to ensure we only get currently open markets
   */
  private async bulkLoadMarkets(): Promise<any[]> {
    console.log('📊 Phase 1: Bulk Loading ONLY open markets...');
    
    const allMarkets: any[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    const maxPages = 200; // Fetch as many markets as possible (200 pages * 100 = 20,000 markets max)
    
    do {
      pageCount++;
      
      try {
        // Fetch ONLY open markets (status='open' filters out unopened, closed, and settled)
        // Use mveFilter='exclude' to filter out 142k multivariate combo markets
        const response = await this.marketApi.getMarkets(
          100, // limit
          cursor || undefined,
          undefined, // eventTicker
          undefined, // seriesTicker
          undefined, // minCreatedTs
          undefined, // maxCreatedTs
          undefined, // maxCloseTs
          undefined, // minCloseTs
          undefined, // minSettledTs
          undefined, // maxSettledTs
          'open', // status - ONLY fetch currently open markets
          undefined, // tickers
          'exclude', // mveFilter - EXCLUDE multivariate markets (reduces from 166k to 24k markets)
        );
        
        const markets = response.data.markets || [];
        allMarkets.push(...markets);
        cursor = response.data.cursor || null;

        // Only log every 50 pages to reduce noise
        if (pageCount % 50 === 0) {
          console.log(`   Progress: ${allMarkets.length} markets loaded...`);
        }
        
        // Rate limit: wait 500ms between pages
        if (cursor && markets.length > 0) {
          await sleep(500);
        }
      } catch (error: any) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          console.warn(`   ⚠️ Rate limited. Waiting ${waitTime}ms...`);
          await sleep(waitTime);
          continue;
        }
        throw error;
      }
    } while (cursor && pageCount < maxPages);
    
    console.log(`   ✅ Phase 1 Complete: Loaded ${allMarkets.length} markets from ${pageCount} page(s)`);
    return allMarkets;
  }

  /**
   * PHASE 2: Basic Filter - Filter by volume, spread, timing (in-memory, no API calls)
   */
  private basicFilter(
    rawMarkets: any[],
    criteria: MarketCriteria
  ): ScreenedMarket[] {
    console.log('🔍 Phase 2: Basic Filtering (in-memory)...');
    
    const minVolume = criteria.minVolume24h || 2000;
    const minOpenInterest = criteria.minOpenInterest || 2000;
    const maxSpread = criteria.maxSpreadCents; // Optional - undefined means no spread filter
    const minOdds = criteria.minOdds || TRADING_CONSTANTS.MIN_ODDS;
    const maxDays = criteria.maxDaysToResolution || 3;
    
    const filtered: ScreenedMarket[] = [];
    const now = new Date();
    
    // Debug: Track filtering statistics
    let stats = {
      totalProcessed: 0,
      skippedNotOpen: 0,
      skippedNoPricing: 0,
      skipped100Percent: 0,
      skippedLowConviction: 0,
      skippedComplex: 0,
      skippedLowVolume: 0,
      skippedLowOpenInterest: 0,
      skippedSpread: 0,
      skippedInvalidDate: 0,
      skippedDaysToResolution: 0,
    };
    
    for (const market of rawMarkets) {
      stats.totalProcessed++;
      // Note: All markets from Phase 1 are already filtered to status='open' by the API
      // No need to check status again - API has already filtered to only open markets
      
      // Extract pricing
      let yesBidDollars = 0;
      let noBidDollars = 0;
      
      if (typeof market.yes_bid_dollars === 'string') {
        yesBidDollars = parseFloat(market.yes_bid_dollars) || 0;
      } else if (typeof market.yes_bid_dollars === 'number') {
        yesBidDollars = market.yes_bid_dollars;
      }
      
      if (typeof market.no_bid_dollars === 'string') {
        noBidDollars = parseFloat(market.no_bid_dollars) || 0;
      } else if (typeof market.no_bid_dollars === 'number') {
        noBidDollars = market.no_bid_dollars;
      }
      
      // Skip markets with no pricing
      if (yesBidDollars === 0 && noBidDollars === 0) {
        stats.skippedNoPricing++;
        continue;
      }
      
      // Skip markets at 100% (no profit potential)
      if (yesBidDollars >= 0.999 || noBidDollars >= 0.999) {
        stats.skipped100Percent++;
        continue;
      }
      
      // Filter by odds (high conviction: yes >= minOdds OR no >= minOdds)
      const yesOddsPercent = yesBidDollars * 100;
      const noOddsPercent = noBidDollars * 100;
      const isHighConviction = 
        yesOddsPercent >= (minOdds * 100) || 
        noOddsPercent >= (minOdds * 100) ||
        yesOddsPercent <= ((1 - TRADING_CONSTANTS.MAX_ODDS) * 100) ||
        noOddsPercent <= ((1 - TRADING_CONSTANTS.MAX_ODDS) * 100);
      
      if (!isHighConviction) {
        stats.skippedLowConviction++;
        continue;
      }
      
      // Filter by simple yes/no question
      const question = market.title || market.question || market.subtitle || '';
      if (!isSimpleYesNoMarket(question)) {
        stats.skippedComplex++;
        continue;
      }
      
      // Filter by volume
      const volume24h = parseFloat(market.volume_24h || market.volume || 0);
      if (volume24h < minVolume) {
        stats.skippedLowVolume++;
        continue;
      }
      
      // Filter by open interest
      const openInterest = parseFloat(market.liquidity || market.open_interest || 0);
      if (openInterest < minOpenInterest) {
        stats.skippedLowOpenInterest++;
        continue;
      }
      
      // Calculate spread (only filter if maxSpread is provided)
      const spreadCents = calculateSpreadCents(market);
      if (maxSpread !== undefined && spreadCents > maxSpread) {
        stats.skippedSpread++;
        continue;
      }
      
      // Filter by resolution time
      let endDate: Date;
      try {
        const expirationTime = market.expected_expiration_time || market.expiration_time || market.close_time || market.end_date;
        endDate = new Date(expirationTime);
        if (isNaN(endDate.getTime())) {
          stats.skippedInvalidDate++;
          continue; // Skip invalid dates
        }
      } catch (e) {
        stats.skippedInvalidDate++;
        continue;
      }
      
      const daysToResolution = calculateDaysToResolution(endDate);
      if (daysToResolution > maxDays || daysToResolution < 0) {
        stats.skippedDaysToResolution++;
        continue;
      }
      
      // Calculate liquidity score
      const liquidityScore = calculateLiquidityScore(
        volume24h,
        openInterest,
        spreadCents,
        minVolume,
        minOpenInterest,
        maxSpread // Optional - undefined means spread not considered
      );
      
      // Add to filtered list
      filtered.push({
        market_id: market.ticker || market.market_id || market.id,
        question: question,
        end_date: endDate,
        yes_odds: yesBidDollars,
        no_odds: noBidDollars,
        liquidity: openInterest,
        volume_24h: volume24h,
        resolved: false,
        category: market.category || market.event_ticker || undefined,
        liquidityScore,
        spreadCents,
      });
    }
    
    console.log(`   ✅ Phase 2 Complete: ${filtered.length} markets passed basic filters`);
    const filteringStats = {
      totalProcessed: stats.totalProcessed,
      skippedNotOpen: stats.skippedNotOpen,
      skippedNoPricing: stats.skippedNoPricing,
      skipped100Percent: stats.skipped100Percent,
      skippedLowConviction: stats.skippedLowConviction,
      skippedComplex: stats.skippedComplex,
      skippedLowVolume: stats.skippedLowVolume,
      skippedLowOpenInterest: stats.skippedLowOpenInterest,
      skippedSpread: stats.skippedSpread,
      skippedInvalidDate: stats.skippedInvalidDate,
      skippedDaysToResolution: stats.skippedDaysToResolution,
      passed: filtered.length,
    };
    console.log(`   📊 Filtering stats:`, filteringStats);
    // Store stats for later retrieval
    this.filteringStats = filteringStats;
    return filtered;
  }

  /**
   * PHASE 3: Rank - Sort by liquidity score (in-memory)
   */
  private rankMarkets(markets: ScreenedMarket[]): ScreenedMarket[] {
    console.log('📈 Phase 3: Ranking by liquidity score...');
    
    // Sort by liquidity score (descending)
    const ranked = [...markets].sort((a, b) => b.liquidityScore - a.liquidityScore);
    
    // Assign ranks
    ranked.forEach((market, index) => {
      market.screeningRank = index + 1;
    });
    
    console.log(`   ✅ Phase 3 Complete: Ranked ${ranked.length} markets`);
    if (ranked.length > 0) {
      console.log(`   🏆 Top 3 scores: ${ranked.slice(0, 3).map(m => m.liquidityScore.toFixed(1)).join(', ')}`);
    }
    
    return ranked;
  }

  /**
   * PHASE 4: Depth Check - Validate execution quality for top candidates (30-50 API calls)
   */
  private async depthCheck(
    rankedMarkets: ScreenedMarket[],
    criteria: MarketCriteria
  ): Promise<ScreenedMarket[]> {
    const topN = criteria.topNForDepthCheck || 40;
    const orderSize = criteria.orderSize || 100;
    const minLiquidity = criteria.minOpenInterest || TRADING_CONSTANTS.MIN_LIQUIDITY;
    
    console.log(`🔬 Phase 4: Checking orderbook depth for top ${topN} candidates...`);
    
    const topCandidates = rankedMarkets.slice(0, topN);
    const validated: ScreenedMarket[] = [];
    
    for (let i = 0; i < topCandidates.length; i++) {
      const market = topCandidates[i];
      
      try {
        // Get orderbook depth
        const { liquidity: orderbookLiquidity, side } = await getOrderbookWithLiquidity(market.market_id);
        
        market.orderbookLiquidity = orderbookLiquidity;
        
        // Estimate slippage
        // Simple estimate: if order size > liquidity at best price, slippage increases
        const slippage = orderbookLiquidity > 0 
          ? Math.min(1, orderSize / orderbookLiquidity) * 0.05 // Max 5% slippage
          : 1.0; // No liquidity = 100% slippage
        
        market.executionSlippage = slippage;
        
        // Only keep markets with sufficient orderbook liquidity
        if (orderbookLiquidity >= minLiquidity && slippage < 0.10) { // Max 10% slippage acceptable
          validated.push(market);
        }
        
        // Rate limit: wait 50ms between orderbook checks (optimized for speed)
        if (i < topCandidates.length - 1) {
          await sleep(50);
        }
      } catch (error: any) {
        // Log error but continue
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
          console.warn(`   ⚠️ Rate limited on market ${market.market_id}. Waiting ${waitTime}ms...`);
          await sleep(waitTime);
          // Retry this market
          i--;
          continue;
        }
        console.warn(`   ⚠️ Failed to check orderbook for ${market.market_id}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ Phase 4 Complete: ${validated.length}/${topCandidates.length} markets passed depth check`);
    
    return validated;
  }

  /**
   * Filtering statistics
   */
  private filteringStats: any = null;

  /**
   * Get last filtering statistics
   */
  getFilteringStats(): any {
    return this.filteringStats;
  }

  /**
   * Main screening method - runs all 4 phases
   */
  async screenMarkets(criteria: MarketCriteria = {}): Promise<ScreenedMarket[]> {
    console.log('🚀 Starting Kalshi Market Screening...');
    console.log(`   Criteria:`, {
      minVolume24h: criteria.minVolume24h || 5000,
      minOpenInterest: criteria.minOpenInterest || 2000,
      maxSpreadCents: criteria.maxSpreadCents || 6,
      orderSize: criteria.orderSize || 100,
      topNForDepthCheck: criteria.topNForDepthCheck || 40,
    });
    
    try {
      // Phase 1: Bulk Load
      const rawMarkets = await this.bulkLoadMarkets();
      
      if (rawMarkets.length === 0) {
        console.log('⚠️ No markets found');
        return [];
      }
      
      // Phase 2: Basic Filter
      const filtered = this.basicFilter(rawMarkets, criteria);
      
      if (filtered.length === 0) {
        console.log('⚠️ No markets passed basic filters');
        return [];
      }
      
      // Phase 3: Rank
      const ranked = this.rankMarkets(filtered);
      
      // Phase 4: Depth Check (only for top N)
      const validated = await this.depthCheck(ranked, criteria);
      
      console.log(`✅ Screening Complete: ${validated.length} tradeable markets identified`);
      
      return validated;
    } catch (error: any) {
      console.error('❌ Screening failed:', error.message);
      throw error;
    }
  }

  /**
   * Export screening results to JSON format
   */
  exportResults(markets: ScreenedMarket[], format: 'json' | 'summary' = 'summary'): string {
    if (format === 'json') {
      return JSON.stringify(markets, null, 2);
    }
    
    // Summary format
    let summary = `\n📊 Market Screening Results\n`;
    summary += `${'='.repeat(60)}\n\n`;
    summary += `Total Markets: ${markets.length}\n\n`;
    
    if (markets.length > 0) {
      summary += `Top 10 Markets:\n`;
      summary += `${'-'.repeat(60)}\n`;
      markets.slice(0, 10).forEach((market, index) => {
        summary += `${index + 1}. ${market.question.substring(0, 50)}...\n`;
        summary += `   Market ID: ${market.market_id}\n`;
        summary += `   Yes Odds: ${(market.yes_odds * 100).toFixed(1)}% | No Odds: ${(market.no_odds * 100).toFixed(1)}%\n`;
        summary += `   Liquidity Score: ${market.liquidityScore.toFixed(1)}/100\n`;
        summary += `   Orderbook Liquidity: ${market.orderbookLiquidity || 'N/A'} contracts\n`;
        summary += `   Spread: ${market.spreadCents.toFixed(1)} cents\n`;
        summary += `   Days to Resolution: ${calculateDaysToResolution(market.end_date).toFixed(1)}\n`;
        summary += `\n`;
      });
    }
    
    return summary;
  }
}

