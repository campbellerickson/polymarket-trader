import { placeOrder, getOrderbook, waitForOrderFill, getMarket } from './client';
import { AnalysisResponse, TradeResult } from '../../types';
import { logTrade } from '../database/queries';
import { calculateContractAmount } from '../utils/kelly';
import { TRADING_CONSTANTS } from '../../config/constants';

export async function executeTrades(
  decisions: AnalysisResponse
): Promise<TradeResult[]> {
  const isForcedTrade = decisions.forcedTrade === true;

  if (isForcedTrade) {
    console.log(`💰 Attempting forced trade (will stop after first success)...`);
  } else {
    console.log(`💰 Executing ${decisions.selectedContracts.length} trades...`);
  }

  const results: TradeResult[] = [];

  for (const decision of decisions.selectedContracts) {
    // If this is a forced trade and we already have a success, stop
    if (isForcedTrade && results.some(r => r.success)) {
      console.log(`   ✅ Forced trade succeeded, skipping remaining contracts`);
      break;
    }
    try {
      console.log(`   Executing: ${decision.contract.question.substring(0, 50)}...`);
      console.log(`   Allocation: $${decision.allocation}, Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`   Cached odds: Yes ${(decision.contract.yes_odds * 100).toFixed(1)}% | No ${((decision.contract.no_odds || (1 - decision.contract.yes_odds)) * 100).toFixed(1)}%`);

      // 1. Fetch LIVE odds from Kalshi (cached odds may be stale/invalid)
      console.log(`   🔄 Fetching live odds from Kalshi...`);
      let liveMarket;
      try {
        liveMarket = await getMarket(decision.contract.market_id);
        console.log(`   ✅ Live odds: Yes ${(liveMarket.yes_odds * 100).toFixed(1)}% | No ${(liveMarket.no_odds * 100).toFixed(1)}%`);

        // Update decision with live odds
        decision.contract.yes_odds = liveMarket.yes_odds;
        decision.contract.no_odds = liveMarket.no_odds;
      } catch (error: any) {
        console.error(`   ❌ Failed to fetch live odds: ${error.message}`);
        throw new Error(`Cannot fetch live odds for ${decision.contract.market_id}`);
      }

      // 2. Validate odds
      const entryOdds = decision.contract.yes_odds;
      if (!entryOdds || entryOdds <= 0 || entryOdds > 1) {
        throw new Error(`Invalid odds after refresh: ${entryOdds}`);
      }

      // 2. Ensure contract is saved to database first
      const { supabase } = await import('../database/client');
      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('market_id', decision.contract.market_id)
        .single();

      let contractDbId: string;
      if (existingContract) {
        contractDbId = existingContract.id;
      } else {
        // Insert contract into database
        const { data: newContract } = await supabase
          .from('contracts')
          .insert({
            market_id: decision.contract.market_id,
            question: decision.contract.question,
            end_date: decision.contract.end_date,
            current_odds: entryOdds,
            category: decision.contract.category,
            liquidity: decision.contract.liquidity,
            volume_24h: decision.contract.volume_24h,
          })
          .select('id')
          .single();

        if (!newContract) {
          throw new Error('Failed to insert contract into database');
        }
        contractDbId = newContract.id;
      }

      // 3. Get current orderbook for logging
      const orderbook = await getOrderbook(decision.contract.market_id);

      // 4. Determine which side to buy (always bet the high-probability side)
      // Strategy: Fade overpriced tail risk by buying the >50% side
      // If yes_odds = 90%, buy YES (fade NO tail risk at 10%)
      // If yes_odds = 30%, buy NO (fade YES tail risk at 30%, since NO is at 70%)
      const side = entryOdds > 0.5 ? 'YES' : 'NO';

      console.log(`   Betting ${side} at ~${(entryOdds * 100).toFixed(1)}% (fading ${side === 'YES' ? 'NO' : 'YES'} tail risk)`);
      console.log(`   Using market order (Kalshi will execute at best available price)`);
      console.log(`   Budget: $${decision.allocation.toFixed(2)}`);
      console.log(`   Orderbook: YES ask=${orderbook.bestYesAsk?.toFixed(3)}, NO ask=${orderbook.bestNoAsk?.toFixed(3)}`);

      // 5. Execute order - pass price for contract calculation
      const order = await placeOrder({
        market: decision.contract.market_id,
        side,
        amount: decision.allocation, // Dollar amount
        price: entryOdds, // Current odds for contract calculation
        type: 'market',
      });

      // Get actual contracts purchased from filled order
      let contractsPurchased = 0;

      if (TRADING_CONSTANTS.DRY_RUN) {
        console.log('   🧪 DRY RUN: Trade simulated');
        // Estimate contracts for dry run
        contractsPurchased = Math.floor(decision.allocation / entryOdds);
      } else {
        console.log(`   ✅ Order placed: ${order.order_id || 'unknown'}`);

        // Market orders should fill quickly
        console.log(`   ⏳ Waiting for order fill...`);
        try {
          const filledOrder = await waitForOrderFill(order.order_id, 30000, 2000); // 30s timeout, 2s polling
          // Get actual filled count from order response
          contractsPurchased = filledOrder.remaining_count !== undefined
            ? (order.count || 10000) - filledOrder.remaining_count
            : (filledOrder.filled_count || 0);
          console.log(`   ✅ Order filled: ${contractsPurchased} contracts purchased`);
        } catch (fillError: any) {
          console.error(`   ⚠️ Order did not fill within 30s: ${fillError.message}`);
          console.error(`   ⚠️ Order may be resting in orderbook - will be tracked for later fill`);
          // Estimate contracts for now (will be updated by sync-orders cron)
          contractsPurchased = Math.floor(decision.allocation / entryOdds);
        }
      }

      // 6. Log to database
      const trade = await logTrade({
        contract_id: contractDbId,
        entry_odds: entryOdds,
        position_size: decision.allocation,
        side, // Use dynamic side (YES if >50%, NO if <50%)
        contracts_purchased: contractsPurchased,
        ai_confidence: decision.confidence,
        ai_reasoning: decision.reasoning,
        risk_factors: decision.riskFactors && decision.riskFactors.length > 0
          ? decision.riskFactors
          : undefined,
      });
      
      results.push({ success: true, trade });
      
    } catch (error: any) {
      console.error(`   ❌ Failed to execute trade:`, error.message);
      results.push({ 
        success: false, 
        error: error.message,
        contract: decision.contract
      });
    }
  }
  
  console.log(`   ✅ Executed ${results.filter(r => r.success).length}/${results.length} trades`);
  return results;
}

