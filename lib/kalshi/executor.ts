import { placeOrder, getOrderbook } from './client';
import { AnalysisResponse, TradeResult } from '../../types';
import { logTrade } from '../database/queries';
import { calculateContractAmount } from '../utils/kelly';
import { TRADING_CONSTANTS } from '../../config/constants';

export async function executeTrades(
  decisions: AnalysisResponse
): Promise<TradeResult[]> {
  console.log(`💰 Executing ${decisions.selectedContracts.length} trades...`);
  
  const results: TradeResult[] = [];

  for (const decision of decisions.selectedContracts) {
    try {
      console.log(`   Executing: ${decision.contract.question.substring(0, 50)}...`);
      console.log(`   Allocation: $${decision.allocation}, Confidence: ${(decision.confidence * 100).toFixed(1)}%`);

      // 1. Validate odds
      const entryOdds = decision.contract.yes_odds;
      if (!entryOdds || entryOdds <= 0 || entryOdds > 1) {
        throw new Error(`Invalid odds: ${entryOdds}`);
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

      // 3. Get current orderbook
      const orderbook = await getOrderbook(decision.contract.market_id);

      // 4. Calculate contracts to purchase
      const contracts = calculateContractAmount(
        decision.allocation,
        entryOdds
      );

      // 5. Execute market order
      const order = await placeOrder({
        market: decision.contract.market_id,
        side: 'YES', // Always buying high side
        amount: contracts,
        price: orderbook.bestYesAsk || entryOdds,
      });

      if (TRADING_CONSTANTS.DRY_RUN) {
        console.log('   🧪 DRY RUN: Trade simulated');
      } else {
        console.log(`   ✅ Order placed: ${order.order_id || 'unknown'}`);
      }

      // 6. Log to database
      const trade = await logTrade({
        contract_id: contractDbId,
        entry_odds: entryOdds,
        position_size: decision.allocation,
        side: 'YES',
        contracts_purchased: contracts,
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

