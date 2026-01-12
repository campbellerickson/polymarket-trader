import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get ai_decisions with trade info
    const { data: decisions, error } = await supabase
      .from('ai_decisions')
      .select('id, trade_id, contract_snapshot, allocated_amount, outcome, created_at, trade:trades(id, side, status)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Get resolved trades
    const { data: resolvedTrades, error: tradesError } = await supabase
      .from('trades')
      .select('id, side, status, contract:contracts(market_id)')
      .in('status', ['won', 'lost'])
      .order('resolved_at', { ascending: false })
      .limit(10);

    if (tradesError) throw tradesError;

    // Get ai_decisions that should have outcomes
    const { data: shouldHaveOutcomes, error: shouldHaveError } = await supabase
      .from('ai_decisions')
      .select('id, trade_id, outcome, trade:trades(status)')
      .not('trade_id', 'is', null)
      .is('outcome', null)
      .limit(20);

    if (shouldHaveError) throw shouldHaveError;

    return res.status(200).json({
      success: true,
      recentDecisions: decisions,
      resolvedTrades: resolvedTrades,
      decisionsNeedingOutcomes: shouldHaveOutcomes,
      stats: {
        totalDecisions: decisions?.length || 0,
        decisionsWithTradeId: decisions?.filter(d => d.trade_id).length || 0,
        decisionsWithOutcome: decisions?.filter(d => d.outcome).length || 0,
        resolvedTradesCount: resolvedTrades?.length || 0,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
