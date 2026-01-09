import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAndResolveOpenTrades } from '../../../lib/kalshi/resolver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check balance first - no point in doing anything if we can't trade
    const { getAccountBalance } = await import('../../../lib/kalshi/client');
    const liveBalance = await getAccountBalance();
    console.log(`💵 Live balance: $${liveBalance.toFixed(2)}`);

    if (liveBalance < 5) {
      console.log(`⚠️ Insufficient funds for trading (need at least $5)`);
      console.log(`⏭️ Ending cron job early`);
      return res.status(200).json({
        success: true,
        resolvedCount: 0,
        availableCash: liveBalance,
        reinvestment: { attempted: false, reason: 'insufficient_funds' }
      });
    }

    console.log('🔍 Checking for resolved trades...');
    const result = await checkAndResolveOpenTrades();

    // If we should trigger a new trade (cash > $20), execute trading logic
    if (result.shouldTriggerTrade) {
      console.log('\n🎯 Triggering new trade with available cash...');

      const { scanContracts } = await import('../../../lib/kalshi/scanner');
      const { analyzeContracts } = await import('../../../lib/ai/analyzer');
      const { executeTrades } = await import('../../../lib/kalshi/executor');
      const { getCurrentBankroll } = await import('../../../lib/database/queries');
      const { TRADING_CONSTANTS } = await import('../../../config/constants');

      // 1. First, run screen-markets to refresh the market cache
      console.log('📊 Refreshing market cache...');
      try {
        const { KalshiMarketScreener } = await import('../../../lib/kalshi/screener');
        const { cacheMarkets } = await import('../../../lib/kalshi/cache');

        const screener = new KalshiMarketScreener();
        const screenedMarkets = await screener.screenMarkets({
          minVolume24h: 2000,
          minOpenInterest: 2000,
          orderSize: 100,
          topNForDepthCheck: 15,
          minOdds: TRADING_CONSTANTS.MIN_ODDS,
          maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
        });

        if (screenedMarkets.length > 0) {
          await cacheMarkets(screenedMarkets);
        }
        console.log(`✅ Market cache refreshed with ${screenedMarkets.length} markets`);
      } catch (screenError: any) {
        console.error('⚠️ Failed to refresh market cache:', screenError.message);
        // Continue anyway - we might have stale cache
      }

      // 2. Scan for contracts
      const contracts = await scanContracts({
        minOdds: TRADING_CONSTANTS.MIN_ODDS,
        maxOdds: TRADING_CONSTANTS.MAX_ODDS,
        maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
        minLiquidity: TRADING_CONSTANTS.MIN_LIQUIDITY,
        excludeCategories: TRADING_CONSTANTS.EXCLUDE_CATEGORIES,
      });

      console.log(`📊 Found ${contracts.length} qualifying contracts`);

      if (contracts.length === 0) {
        console.log(`⚠️ No qualifying contracts found for reinvestment.`);
        return res.status(200).json({
          success: true,
          resolvedCount: result.resolvedCount,
          availableCash: result.availableCash,
          reinvestment: { attempted: true, executed: false, reason: 'no_contracts' }
        });
      }

      // 3. Get AI analysis (use available cash as budget)
      const analysis = await analyzeContracts({
        contracts,
        historicalPerformance: [],
        currentBankroll: await getCurrentBankroll(),
        dailyBudget: result.availableCash, // Use available cash as budget
      });

      console.log(`🤖 AI selected ${analysis.selectedContracts.length} contracts for reinvestment`);

      // 4. Execute trades if AI selected any
      if (analysis.selectedContracts.length > 0) {
        const tradeResults = await executeTrades(analysis);
        console.log(`✅ Executed ${tradeResults.filter(r => r.success).length}/${tradeResults.length} reinvestment trades`);

        return res.status(200).json({
          success: true,
          resolvedCount: result.resolvedCount,
          availableCash: result.availableCash,
          reinvestment: {
            attempted: true,
            executed: true,
            tradesExecuted: tradeResults.filter(r => r.success).length,
            totalAllocated: analysis.totalAllocated
          }
        });
      }
    }

    return res.status(200).json({
      success: true,
      resolvedCount: result.resolvedCount,
      availableCash: result.availableCash,
      reinvestment: { attempted: false }
    });
  } catch (error: any) {
    console.error('❌ Resolution check failed:', error);
    const { logCronError } = await import('../../../lib/utils/logger');
    await logCronError('check-resolutions', error);
    return res.status(500).json({ error: error.message });
  }
}

