import { getMarket } from './client';
import { getOpenTrades, updateTrade } from '../database/queries';
import { Trade } from '../../types';

export async function checkAndResolveOpenTrades(): Promise<void> {
  console.log('🔍 Checking for resolved trades...');
  
  const openTrades = await getOpenTrades();
  console.log(`   Found ${openTrades.length} open trades`);

  for (const trade of openTrades) {
    try {
      // Check if market has resolved
      const market = await getMarket(trade.contract.market_id);
      
      if (market.resolved && market.outcome) {
        const won = market.outcome === trade.side;
        const pnl = calculatePnL(trade, market);
        
        // Update trade
        await updateTrade(trade.id, {
          status: won ? 'won' : 'lost',
          exit_odds: market.final_odds || market.yes_odds,
          pnl,
          resolved_at: market.resolved_at || new Date(),
        });
        
        console.log(`${won ? '✅ WON' : '❌ LOST'}: ${trade.contract.question.substring(0, 50)}... | P&L: $${pnl.toFixed(2)}`);
      }
    } catch (error: any) {
      console.error(`   ⚠️ Error checking trade ${trade.id}:`, error.message);
    }
  }
}

function calculatePnL(trade: Trade, market: any): number {
  if (trade.status === 'won') {
    // If won, P&L = contracts * 1.0 - position_size
    return (trade.contracts_purchased * 1.0) - trade.position_size;
  } else {
    // If lost, P&L = -position_size (total loss)
    return -trade.position_size;
  }
}

