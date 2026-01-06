import type { VercelRequest, VercelResponse } from '@vercel/node';
import { scanContracts } from '../../lib/kalshi/scanner';
import { analyzeContracts } from '../../lib/ai/analyzer';
import { executeTrades } from '../../lib/kalshi/executor';
import { checkAndResolveOpenTrades } from '../../lib/kalshi/resolver';
import { monitorStopLosses } from '../../lib/trading/stop-loss';
import { getRecentTrades, getCurrentBankroll } from '../../lib/database/queries';
import { sendDailySummary, sendErrorAlert } from '../../lib/utils/notifications';
import { TRADING_CONSTANTS } from '../../config/constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  let contracts: any[] = [];
  
  try {
    console.log('🔍 Starting daily scan...');
    
    // 1. Scan for contracts
    contracts = await scanContracts({
      minOdds: TRADING_CONSTANTS.MIN_ODDS,
      maxOdds: TRADING_CONSTANTS.MAX_ODDS,
      maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
      minLiquidity: TRADING_CONSTANTS.MIN_LIQUIDITY,
      excludeCategories: TRADING_CONSTANTS.EXCLUDE_CATEGORIES,
    });
    
    console.log(`📊 Found ${contracts.length} qualifying contracts`);
    
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
    
    // 4. Execute trades
    const results = await executeTrades(analysis);
    
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
    console.error('❌ Cron job failed:', error);
    const { logCronError } = await import('../../lib/utils/logger');
    await logCronError('daily-scan', error, { contracts_analyzed: contracts?.length });
    await sendErrorAlert(error);
    return res.status(500).json({ error: error.message });
  }
}

