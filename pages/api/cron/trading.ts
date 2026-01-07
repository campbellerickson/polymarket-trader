import type { NextApiRequest, NextApiResponse } from 'next';
import { scanContracts } from '../../../lib/kalshi/scanner';
import { analyzeContracts } from '../../../lib/ai/analyzer';
import { executeTrades } from '../../../lib/kalshi/executor';
import { checkAndResolveOpenTrades } from '../../../lib/kalshi/resolver';
import { monitorStopLosses } from '../../../lib/trading/stop-loss';
import { getRecentTrades, getCurrentBankroll } from '../../../lib/database/queries';
import { sendDailySummary, sendErrorAlert, sendBuyAlert } from '../../../lib/utils/notifications';
import { getAccountBalance } from '../../../lib/kalshi/client';
import { TRADING_CONSTANTS } from '../../../config/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  let contracts: any[] = [];
  
  try {
    console.log('🔍 Starting trading job...');
    
    // 1. Scan for contracts
    contracts = await scanContracts({
      minOdds: TRADING_CONSTANTS.MIN_ODDS,
      maxOdds: TRADING_CONSTANTS.MAX_ODDS,
      maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
      minLiquidity: TRADING_CONSTANTS.MIN_LIQUIDITY,
      excludeCategories: TRADING_CONSTANTS.EXCLUDE_CATEGORIES,
    });
    
    console.log(`📊 Found ${contracts.length} qualifying contracts`);
    if (contracts.length === 0) {
      console.log(`⚠️ No qualifying contracts found. Skipping today.`);
      const { logError } = await import('../../../lib/utils/logger');
      await logError(
        'warning',
        `No qualifying contracts found. Skipping today.`,
        undefined,
        { qualifying_contracts: 0 },
        'cron'
      );
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: 'no_contracts',
        contracts_analyzed: 0,
      });
    }
    
    // 2. Build historical context for AI
    const historicalPerformance = await getRecentTrades(50);
    
    // 3. Get AI analysis
    const analysis = await analyzeContracts({
      contracts,
      historicalPerformance,
      currentBankroll: await getCurrentBankroll(),
      dailyBudget: TRADING_CONSTANTS.DAILY_BUDGET,
    });
    
    console.log(`🤖 AI selected ${analysis.selectedContracts.length} contracts`);
    console.log(`💰 Total allocation: $${analysis.totalAllocated}`);

    // 3.5. Enforce "minimum 1 trade every 2 days" rule
    if (analysis.selectedContracts.length === 0) {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const { getTradesInRange } = await import('../../../lib/database/queries');
      const recentTrades = await getTradesInRange(twoDaysAgo, new Date());

      if (recentTrades.length === 0) {
        console.log('⚠️ AI selected 0 contracts, but no trades in 2 days. Forcing 1 trade...');

        // Force AI to pick the best contract
        const bestContract = contracts[0]; // Contracts are already sorted by quality
        analysis.selectedContracts = [{
          contract: bestContract,
          allocation: TRADING_CONSTANTS.DAILY_BUDGET,
          confidence: 0.75,
          reasoning: 'FORCED: Minimum 1 trade every 2 days requirement',
          riskFactors: ['Forced trade due to 2-day rule'],
        }];
        analysis.totalAllocated = TRADING_CONSTANTS.DAILY_BUDGET;
        console.log(`   Forced selection: ${bestContract.question}`);
      } else {
        console.log(`✅ AI selected 0 contracts, but we traded ${recentTrades.length}x in last 2 days. Skipping.`);
      }
    }

    // 4. Execute trades
    const results = await executeTrades(analysis);

    // 4.5 Send buy alerts for successful trades
    for (const result of results) {
      if (result.success && result.trade) {
        try {
          await sendBuyAlert({
            question: result.trade.contract?.question || 'Unknown',
            side: result.trade.side,
            allocation: result.trade.position_size,
            odds: result.trade.entry_odds,
            reasoning: result.trade.ai_reasoning || 'No reasoning provided',
          });
        } catch (err) {
          console.error('Failed to send buy alert:', err);
          // Don't fail the whole job if notification fails
        }
      }
    }
    
    // 5. Check stop losses BEFORE resolving trades
    console.log('🛡️ Checking stop losses...');
    await monitorStopLosses();
    
    // 6. Check for resolutions on remaining open trades
    await checkAndResolveOpenTrades();
    
    // 7. Send notifications
    await sendDailySummary({
      contracts_analyzed: contracts.length,
      trades_executed: results.filter(r => r.success).length,
      total_allocated: analysis.totalAllocated,
      current_bankroll: await getCurrentBankroll(),
    });
    
    return res.status(200).json({
      success: true,
      contracts_analyzed: contracts.length,
      trades_executed: results.length,
      results
    });
    
  } catch (error: any) {
    console.error('❌ Trading job failed:', error);
    console.error('   Stack:', error.stack);
    console.error('   Error details:', JSON.stringify({
      message: error.message,
      name: error.name,
      cause: error.cause,
    }, null, 2));
    
    const { logCronError } = await import('../../../lib/utils/logger');
    await logCronError('trading', error, { contracts_analyzed: contracts?.length });
    await sendErrorAlert(error);
    
    // Return detailed error for debugging
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      details: {
        message: error.message,
        name: error.name,
        cause: error.cause,
      }
    });
  }
}

