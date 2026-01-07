import type { NextApiRequest, NextApiResponse } from 'next';
import { KalshiMarketScreener, MarketCriteria } from '../../../lib/kalshi/screener';
import { TRADING_CONSTANTS } from '../../../config/constants';

/**
 * Test endpoint for market screening
 * Uses the new 4-phase efficient screening strategy
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🧪 Testing market screening...');
    
    // Configure screening criteria
    const criteria: MarketCriteria = {
      minVolume24h: Number(req.query.minVolume24h) || 5000,
      minOpenInterest: Number(req.query.minOpenInterest) || 2000,
      maxSpreadCents: Number(req.query.maxSpreadCents) || 6,
      orderSize: Number(req.query.orderSize) || 100,
      topNForDepthCheck: Number(req.query.topNForDepthCheck) || 40,
      minOdds: Number(req.query.minOdds) || TRADING_CONSTANTS.MIN_ODDS,
      maxDaysToResolution: Number(req.query.maxDaysToResolution) || TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
    };
    
    console.log('   Criteria:', criteria);
    
    // Run screening
    const screener = new KalshiMarketScreener();
    const screenedMarkets = await screener.screenMarkets(criteria);
    
    // Generate summary
    const summary = screener.exportResults(screenedMarkets, 'summary');
    console.log(summary);
    
    return res.status(200).json({
      success: true,
      criteria,
      results: {
        totalMarkets: screenedMarkets.length,
        markets: screenedMarkets.map(m => ({
          market_id: m.market_id,
          question: m.question,
          yes_odds: `${(m.yes_odds * 100).toFixed(1)}%`,
          no_odds: `${(m.no_odds * 100).toFixed(1)}%`,
          liquidityScore: m.liquidityScore.toFixed(1),
          spreadCents: m.spreadCents.toFixed(1),
          orderbookLiquidity: m.orderbookLiquidity || null,
          executionSlippage: m.executionSlippage ? `${(m.executionSlippage * 100).toFixed(1)}%` : null,
          screeningRank: m.screeningRank,
          volume_24h: m.volume_24h,
          liquidity: m.liquidity,
          end_date: m.end_date.toISOString(),
        })),
      },
      summary: summary,
    });

  } catch (error: any) {
    console.error('❌ Market screening test failed:', error);
    
    // If rate limited, return info
    if (error.message.includes('rate') || error.message.includes('429') || error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limited',
        message: 'Kalshi API rate limit exceeded. Please wait before retrying.',
      });
    }
    
    return res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

