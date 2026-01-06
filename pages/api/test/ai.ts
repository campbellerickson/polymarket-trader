import type { NextApiRequest, NextApiResponse } from 'next';
import { scanContracts } from '../../../lib/kalshi/scanner';
import { analyzeContracts } from '../../../lib/ai/analyzer';
import { getRecentTrades, getCurrentBankroll } from '../../../lib/database/queries';
import { TRADING_CONSTANTS } from '../../../config/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require the cron secret so this endpoint isn't publicly callable
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const limit = Math.max(1, Math.min(10, Number(req.query.limit || 10)));

    // 1) Scan markets using production criteria (includes < 2 days to resolution)
    const contracts = (await scanContracts()).slice(0, limit);
    if (contracts.length === 0) {
      return res.status(200).json({
        ok: true,
        note: 'No qualifying Kalshi contracts found (per current criteria).',
        contracts_analyzed: 0,
        dailyBudget: TRADING_CONSTANTS.DAILY_BUDGET,
        selections: [],
        total_allocated: 0,
        strategy_notes: 'No trade recommendation for today.',
      });
    }

    // 2) Get context for the analyzer
    const historicalPerformance = await getRecentTrades(50);
    const currentBankroll = await getCurrentBankroll();

    // 3) Run the AI analyzer only (no trade execution here)
    const analysis = await analyzeContracts({
      contracts,
      historicalPerformance,
      currentBankroll,
      dailyBudget: TRADING_CONSTANTS.DAILY_BUDGET,
    });

    return res.status(200).json({
      ok: true,
      note: 'AI analysis only — no trades executed',
      contracts_analyzed: contracts.length,
      dailyBudget: TRADING_CONSTANTS.DAILY_BUDGET,
      selections: analysis.selectedContracts.map(s => ({
        market_id: s.contract.market_id,
        question: s.contract.question,
        end_date: s.contract.end_date,
        current_odds: s.contract.current_odds,
        allocation: s.allocation,
        confidence: s.confidence,
        reasoning: s.reasoning,
      })),
      total_allocated: analysis.totalAllocated,
      strategy_notes: analysis.strategyNotes,
    });
  } catch (error: any) {
    console.error('AI test endpoint error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hint: error.message.includes('DECODER') ? 'Check KALSHI_PRIVATE_KEY format in Vercel environment variables' : undefined
    });
  }
}
