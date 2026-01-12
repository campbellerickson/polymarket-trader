import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';
import { getPortfolioApi } from '../../../lib/kalshi/client';

/**
 * Debug endpoint to examine one specific outcome calculation
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get one decision with outcome = 'lost'
    const { data: decisions, error } = await supabase
      .from('ai_decisions')
      .select('id, contract_snapshot, allocated_amount, outcome, created_at')
      .eq('outcome', 'lost')
      .gt('allocated_amount', 0)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!decisions || decisions.length === 0) {
      return res.status(200).json({ message: 'No lost decisions found' });
    }

    // Get settlements from Kalshi for comparison
    const portfolioApi = getPortfolioApi();
    const { data: settlementsResponse } = await portfolioApi.getSettlements(1000);
    const settlements = (settlementsResponse as any).settlements || [];

    // Build settlement map
    const settlementMap = new Map();
    for (const settlement of settlements) {
      settlementMap.set(settlement.ticker, settlement);
    }

    // Analyze each decision
    const analysis = decisions.map(decision => {
      const snapshot = decision.contract_snapshot;
      const marketId = snapshot?.market_id;
      const yesOdds = snapshot?.yes_odds || 0;
      const noOdds = snapshot?.no_odds || 0;

      // Current logic
      const tradedSide = yesOdds < noOdds ? 'YES' : 'NO';

      // Alternative logic
      const altTradedSide = yesOdds > noOdds ? 'YES' : 'NO';

      const settlement = settlementMap.get(marketId);
      const marketOutcome = settlement?.result;

      return {
        decision_id: decision.id,
        market_id: marketId,
        market_title: snapshot?.title,
        yes_odds: yesOdds,
        no_odds: noOdds,
        current_logic: {
          traded_side: tradedSide,
          market_result: marketOutcome,
          would_win: (tradedSide === 'YES' && marketOutcome?.toLowerCase() === 'yes') ||
                     (tradedSide === 'NO' && marketOutcome?.toLowerCase() === 'no'),
        },
        alternative_logic: {
          traded_side: altTradedSide,
          market_result: marketOutcome,
          would_win: (altTradedSide === 'YES' && marketOutcome?.toLowerCase() === 'yes') ||
                     (altTradedSide === 'NO' && marketOutcome?.toLowerCase() === 'no'),
        },
        current_outcome: decision.outcome,
      };
    });

    return res.status(200).json({
      success: true,
      samples: analysis,
      note: 'Current logic: yesOdds < noOdds ? YES : NO (bets lower probability)\nAlternative: yesOdds > noOdds ? YES : NO (bets higher probability)'
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
