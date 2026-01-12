import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';
import { getPortfolioApi } from '../../../lib/kalshi/client';

/**
 * Backfill outcomes for ai_decisions using Kalshi's settlements API
 * Matches by market_id since trade_id linkage is broken
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔧 Starting outcomes backfill...');

    // 1. Get all ai_decisions without outcomes
    const { data: decisions, error: decisionsError } = await supabase
      .from('ai_decisions')
      .select('id, contract_snapshot, allocated_amount, created_at')
      .is('outcome', null)
      .gt('allocated_amount', 0) // Only trades that were actually made
      .order('created_at', { ascending: false })
      .limit(100);

    if (decisionsError) throw new Error(`Failed to fetch ai_decisions: ${decisionsError.message}`);

    console.log(`   Found ${decisions?.length || 0} decisions without outcomes`);

    if (!decisions || decisions.length === 0) {
      return res.status(200).json({
        success: true,
        synced: 0,
        message: 'No decisions need backfilling'
      });
    }

    // 2. Get settlements from Kalshi
    const portfolioApi = getPortfolioApi();
    const { data: settlementsResponse } = await portfolioApi.getSettlements(1000);
    const settlements = (settlementsResponse as any).settlements || [];

    console.log(`   Fetched ${settlements.length} settlements from Kalshi`);

    // Build map of market_id -> settlement
    const settlementMap = new Map();
    for (const settlement of settlements) {
      settlementMap.set(settlement.ticker, settlement);
    }

    let synced = 0;

    // 3. Match decisions with settlements and update outcomes
    for (const decision of decisions) {
      try {
        const marketId = decision.contract_snapshot?.market_id;
        if (!marketId) continue;

        const settlement = settlementMap.get(marketId);
        if (!settlement) {
          console.log(`   ⚠️ No settlement found for ${marketId}`);
          continue;
        }

        // Get the side from the contract snapshot
        // If allocated_amount > 0 and the decision was "selected", we need to determine YES or NO
        // We can infer from yes_odds/no_odds which side was likely traded
        const yesOdds = decision.contract_snapshot?.yes_odds || 0;
        const noOdds = decision.contract_snapshot?.no_odds || 0;

        // Assume we bet the lower odds side (higher probability)
        const tradedSide = noOdds > yesOdds ? 'NO' : 'YES';

        // Determine outcome based on settlement
        const marketOutcome = settlement.result; // 'yes' or 'no' from Kalshi
        const wasCorrect = (
          (tradedSide === 'YES' && marketOutcome?.toLowerCase() === 'yes') ||
          (tradedSide === 'NO' && marketOutcome?.toLowerCase() === 'no')
        );

        const outcome = wasCorrect ? 'won' : 'lost';

        // Update the decision
        await supabase
          .from('ai_decisions')
          .update({
            outcome: outcome,
          })
          .eq('id', decision.id);

        console.log(`   ✅ ${marketId}: ${outcome} (traded ${tradedSide}, resolved ${marketOutcome})`);
        synced++;
      } catch (error: any) {
        console.error(`   ❌ Error processing decision ${decision.id}:`, error.message);
        continue;
      }
    }

    return res.status(200).json({
      success: true,
      synced,
      total: decisions.length,
      settlementsFound: settlements.length
    });

  } catch (error: any) {
    console.error('❌ Backfill failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
