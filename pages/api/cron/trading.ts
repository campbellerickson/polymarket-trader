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

    // 2.5. Get available cash from Kalshi (use actual balance, not DAILY_BUDGET constant)
    const availableCash = await getAccountBalance();
    console.log(`💵 Available cash: $${availableCash.toFixed(2)}`);

    // Use the MINIMUM of daily budget or available cash
    const effectiveDailyBudget = Math.min(TRADING_CONSTANTS.DAILY_BUDGET, availableCash);
    console.log(`💰 Effective daily budget: $${effectiveDailyBudget.toFixed(2)} (${effectiveDailyBudget < TRADING_CONSTANTS.DAILY_BUDGET ? 'limited by cash' : 'full budget'})`);

    // 3. Get AI analysis
    const analysis = await analyzeContracts({
      contracts,
      historicalPerformance,
      currentBankroll: await getCurrentBankroll(),
      dailyBudget: effectiveDailyBudget, // Use effective budget (capped by available cash)
    });

    console.log(`🤖 AI selected ${analysis.selectedContracts.length} contracts`);
    console.log(`💰 Total allocation: $${analysis.totalAllocated}`);

    // 3.5. Enforce "minimum 1 SUCCESSFUL trade per day" rule
    if (analysis.selectedContracts.length === 0) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { getTradesInRange } = await import('../../../lib/database/queries');
      const todayTrades = await getTradesInRange(startOfToday, new Date());

      // Only count SUCCESSFUL trades (exclude cancelled orders)
      const successfulTradesToday = todayTrades.filter(t => t.status !== 'cancelled');

      if (successfulTradesToday.length === 0) {
        console.log(`⚠️ AI selected 0 contracts, but no SUCCESSFUL trades today (${todayTrades.length - successfulTradesToday.length} were cancelled). FORCING 1 TRADE PER DAY RULE...`);

        // Force ONLY the top contract (with backups in case it fails)
        // We'll try them one at a time until one succeeds
        const topContracts = contracts.slice(0, Math.min(3, contracts.length));

        // Mark this as a forced trade scenario
        analysis.selectedContracts = topContracts.map(contract => ({
          contract,
          allocation: effectiveDailyBudget, // Use effective budget (respects available cash)
          confidence: 0.75,
          reasoning: 'FORCED: Minimum 1 successful trade per day requirement',
          riskFactors: ['Forced trade - must execute at least 1 trade per day'],
        }));
        analysis.totalAllocated = effectiveDailyBudget;
        analysis.forcedTrade = true; // Flag to tell executor to stop after first success

        console.log(`   Will attempt up to ${topContracts.length} contracts (stops after first success):`);
        topContracts.forEach((c, i) => console.log(`     ${i + 1}. ${c.question.substring(0, 60)}...`));
      } else {
        console.log(`✅ AI selected 0 contracts, but we had ${successfulTradesToday.length} successful trades today. Skipping.`);
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

