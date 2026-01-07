import type { NextApiRequest, NextApiResponse } from 'next';
import { KalshiMarketScreener, MarketCriteria } from '../../../lib/kalshi/screener';
import { cacheMarkets } from '../../../lib/kalshi/cache';
import { TRADING_CONSTANTS } from '../../../config/constants';

/**
 * Daily market screening cron job
 * Runs once per day (7:30 AM) before the daily scan (8:00 AM)
 * 
 * Uses 4-phase efficient screening strategy:
 * 1. Bulk Load - Fetches all open markets (1-2 API calls)
 * 2. Basic Filter - Filters by volume, spread, timing (in-memory, 0 API calls)
 * 3. Rank - Sorts by liquidity score (in-memory, 0 API calls)
 * 4. Depth Check - Validates execution quality for top candidates (30-50 API calls)
 * 
 * Total: ~35-55 API calls per run
 * 
 * This populates the cache with tradeable markets that the daily scan will use.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🚀 Starting daily market screening...');
    console.log('   This runs once per day (7:30 AM) to identify all tradeable markets');
    console.log('   Results are cached for the daily scan (8:00 AM) to use');
    
    // Configure screening criteria
    const criteria: MarketCriteria = {
      minVolume24h: Number(process.env.MIN_VOLUME_24H) || 2000,
      minOpenInterest: Number(process.env.MIN_OPEN_INTEREST) || 2000,
      maxSpreadCents: process.env.MAX_SPREAD_CENTS ? Number(process.env.MAX_SPREAD_CENTS) : undefined, // No spread filter by default
      orderSize: Number(process.env.ORDER_SIZE) || 100, // Expected order size in contracts
      topNForDepthCheck: Number(process.env.TOP_N_FOR_DEPTH_CHECK) || 40, // Check top 40 for orderbook depth
      minOdds: TRADING_CONSTANTS.MIN_ODDS, // 0.85 (85%)
      maxDaysToResolution: Number(process.env.MAX_DAYS_TO_RESOLUTION) || 3, // 3 days
    };
    
    console.log('   Screening criteria:', {
      minVolume24h: criteria.minVolume24h,
      minOpenInterest: criteria.minOpenInterest,
      maxSpreadCents: criteria.maxSpreadCents,
      orderSize: criteria.orderSize,
      topNForDepthCheck: criteria.topNForDepthCheck,
      minOdds: criteria.minOdds,
      maxDaysToResolution: criteria.maxDaysToResolution,
    });
    
    // Run screening
    const screener = new KalshiMarketScreener();
    const screenedMarkets = await screener.screenMarkets(criteria);
    
    // Get filtering statistics
    const filteringStats = screener.getFilteringStats();
    
    // Cache the screened markets for the daily scan to use
    if (screenedMarkets.length > 0) {
      console.log(`💾 Caching ${screenedMarkets.length} screened markets for daily scan...`);
      await cacheMarkets(screenedMarkets);
      console.log(`✅ Cached ${screenedMarkets.length} screened markets successfully`);
    } else {
      console.log('⚠️ No markets passed screening criteria');
    }
    
    // Generate summary
    const summary = screener.exportResults(screenedMarkets, 'summary');
    console.log(summary);
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      marketsScreened: screenedMarkets.length,
      marketsCached: screenedMarkets.length,
      message: `Screened and cached ${screenedMarkets.length} tradeable markets for daily scan`,
      filteringStats: filteringStats, // Include filtering statistics
      summary: {
        totalMarkets: screenedMarkets.length,
        topMarkets: screenedMarkets.slice(0, 10).map(m => ({
          market_id: m.market_id,
          question: m.question.substring(0, 80),
          yes_odds: `${(m.yes_odds * 100).toFixed(1)}%`,
          no_odds: `${(m.no_odds * 100).toFixed(1)}%`,
          liquidityScore: m.liquidityScore.toFixed(1),
          orderbookLiquidity: m.orderbookLiquidity || 'N/A',
          screeningRank: m.screeningRank,
        })),
      },
    });

  } catch (error: any) {
    console.error('❌ Daily market screening failed:', error);
    
    // If rate limited, return success but with wait message
    if (error.message.includes('rate') || error.message.includes('429') || error.response?.status === 429) {
      return res.status(200).json({
        success: false,
        error: 'Rate limited',
        message: 'Will retry on next scheduled run',
        retryAfter: error.message.includes('Wait') ? error.message : 'Next day',
      });
    }
    
    const { logCronError } = await import('../../../lib/utils/logger');
    await logCronError('screen-markets', error);
    
    return res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

