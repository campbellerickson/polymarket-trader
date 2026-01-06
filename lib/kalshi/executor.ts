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

      // 1. Get current orderbook
      const orderbook = await getOrderbook(decision.contract.market_id);
      
      // 2. Calculate contracts to purchase
      const contracts = calculateContractAmount(
        decision.allocation,
        decision.contract.current_odds
      );
      
      // 3. Execute market order
      const order = await placeOrder({
        market: decision.contract.market_id,
        side: 'YES', // Always buying high side
        amount: contracts,
        price: orderbook.bestYesAsk || decision.contract.current_odds,
      });
      
      if (TRADING_CONSTANTS.DRY_RUN) {
        console.log('   🧪 DRY RUN: Trade simulated');
      } else {
        console.log(`   ✅ Order placed: ${order.id}`);
      }
      
      // 4. Log to database
      const trade = await logTrade({
        contract_id: decision.contract.id || '', // Should be set from scanner
        entry_odds: decision.contract.current_odds,
        position_size: decision.allocation,
        side: 'YES',
        contracts_purchased: contracts,
        ai_confidence: decision.confidence,
        ai_reasoning: decision.reasoning,
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

