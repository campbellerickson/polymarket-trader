import { getMarket, getAccountBalance } from './client';
import { getOpenTrades, updateTrade } from '../database/queries';
import { Trade } from '../../types';
import { sendResolutionAlert } from '../utils/notifications';

export async function checkAndResolveOpenTrades(): Promise<{ resolvedCount: number; shouldTriggerTrade: boolean; availableCash: number }> {
  console.log('🔍 Checking for resolved trades...');

  const openTrades = await getOpenTrades();
  console.log(`   Found ${openTrades.length} open trades`);

  let resolvedCount = 0;

  for (const trade of openTrades) {
    try {
      // Check if market has resolved
      const market = await getMarket(trade.contract.market_id);

      if (market.resolved && market.outcome) {
        const won = market.outcome === trade.side;
        const pnl = calculatePnL(trade, won);

        // Update trade
        await updateTrade(trade.id, {
          status: won ? 'won' : 'lost',
          exit_odds: market.final_odds || market.yes_odds,
          pnl,
          resolved_at: market.resolved_at || new Date(),
        });

        console.log(`${won ? '✅ WON' : '❌ LOST'}: ${trade.contract.question.substring(0, 50)}... | P&L: $${pnl.toFixed(2)}`);
        resolvedCount++;

        // Send resolution alert
        try {
          const holdingPeriodHours = (Date.now() - new Date(trade.executed_at).getTime()) / (1000 * 60 * 60);
          await sendResolutionAlert({
            question: trade.contract.question,
            outcome: won ? 'won' : 'lost',
            entryOdds: trade.entry_odds,
            exitOdds: market.final_odds || market.yes_odds,
            pnl,
            holdingPeriod: holdingPeriodHours,
          });
        } catch (err) {
          console.error('Failed to send resolution alert:', err);
          // Don't fail resolution if notification fails
        }
      }
    } catch (error: any) {
      console.error(`   ⚠️ Error checking trade ${trade.id}:`, error.message);
    }
  }

  // After resolving trades, check if we should trigger a new trade
  console.log(`\n💰 Checking available cash after resolutions...`);
  const availableCash = await getAccountBalance();
  const shouldTriggerTrade = availableCash > 0;

  if (shouldTriggerTrade) {
    console.log(`   ✅ Available cash: $${availableCash.toFixed(2)} > $0 - Will trigger new trade`);
  } else {
    console.log(`   ⏸️ Available cash: $${availableCash.toFixed(2)} = $0 - No new trade needed`);
  }

  return {
    resolvedCount,
    shouldTriggerTrade,
    availableCash
  };
}

function calculatePnL(trade: Trade, won: boolean): number {
  if (won) {
    // If won, P&L = contracts * $1.00 - position_size
    // Each winning contract pays out $1.00
    return (trade.contracts_purchased * 1.0) - trade.position_size;
  } else {
    // If lost, P&L = -position_size (total loss, contracts worth $0)
    return -trade.position_size;
  }
}

