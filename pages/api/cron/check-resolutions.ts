import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAndResolveOpenTrades } from '../../../lib/kalshi/resolver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
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
        const { screenAndCacheMarkets } = await import('../../../lib/kalshi/market-screener');
        await screenAndCacheMarkets();
        console.log('✅ Market cache refreshed');
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

