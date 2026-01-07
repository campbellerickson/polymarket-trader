import type { NextApiRequest, NextApiResponse } from 'next';
import { getCachedMarkets } from '../../../lib/kalshi/cache';
import { getOrderbookWithLiquidity, getAccountBalance, placeOrder } from '../../../lib/kalshi/client';
import { calculateDaysToResolution } from '../../../lib/kalshi/client';
import { calculateContractAmount } from '../../../lib/utils/kelly';
import { Market } from '../../../types';

/**
 * Test endpoint to purchase a $5 contract
 * Finds a random contract with >80% yes odds and sufficient liquidity
 * Uses the same execution logic as the main trading system
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST to prevent accidental executions
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST to execute purchase.' });
  }

  // Require CRON_SECRET for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const TEST_AMOUNT = 5; // $5 purchase
  const MIN_YES_ODDS = 0.80; // 80% minimum
  const MIN_LIQUIDITY = 100; // Minimum contracts available

  const result: any = {
    timestamp: new Date().toISOString(),
    testAmount: TEST_AMOUNT,
    criteria: {
      minYesOdds: MIN_YES_ODDS,
      minLiquidity: MIN_LIQUIDITY,
    },
    steps: {
      balanceCheck: null as any,
      marketSearch: null as any,
      orderbookCheck: null as any,
      orderExecution: null as any,
    },
    success: false,
    error: null as string | null,
  };

  try {
    // Step 1: Check account balance
    try {
      console.log('💰 Checking account balance...');
      const balance = await getAccountBalance();
    result.steps.balanceCheck = {
      success: true,
      balance,
      sufficient: balance >= TEST_AMOUNT,
    };
    
      if (balance < TEST_AMOUNT) {
        result.error = `Insufficient balance: $${balance.toFixed(2)} < $${TEST_AMOUNT}`;
        return res.status(400).json(result);
      }
      
      console.log(`   ✅ Balance: $${balance.toFixed(2)}`);
    } catch (error: any) {
      result.steps.balanceCheck = {
        success: false,
        error: error.message,
      };
      result.error = `Balance check failed: ${error.message}`;
      return res.status(500).json(result);
    }

    // Step 2: Find qualifying contract
    try {
    console.log(`🔍 Searching for contract with >${MIN_YES_ODDS * 100}% yes odds...`);
    const allMarkets = await getCachedMarkets();
    
    if (allMarkets.length === 0) {
      result.error = 'No cached markets found. Market refresh cron may not have run yet.';
      return res.status(400).json(result);
    }

    // Filter for high yes odds (>80%)
    const candidates: Market[] = [];
    const now = new Date();

    for (const market of allMarkets) {
      // Skip invalid/zero odds
      if (!market.yes_odds || market.yes_odds === 0 || market.yes_odds === null) {
        continue;
      }

      // Must have >80% yes odds
      if (market.yes_odds < MIN_YES_ODDS) {
        continue;
      }

      // Must be resolved within 2 days (same as main scanner)
      const daysToResolution = calculateDaysToResolution(market.end_date);
      if (daysToResolution > 2 || daysToResolution < 0) {
        continue;
      }

      // Must not be resolved
      if (market.resolved) {
        continue;
      }

      candidates.push(market);
    }

      result.steps.marketSearch = {
        success: true,
        totalMarkets: allMarkets.length,
        qualifyingCount: candidates.length,
        candidates: candidates.slice(0, 5).map(m => ({
          market_id: m.market_id,
          question: m.question.substring(0, 80),
          yes_odds: m.yes_odds,
          end_date: m.end_date,
        })),
      };

      if (candidates.length === 0) {
        result.error = `No qualifying contracts found (need >${MIN_YES_ODDS * 100}% yes odds, <2 days to resolution)`;
        return res.status(404).json(result);
      }

      // Pick a random candidate
      const selectedMarket = candidates[Math.floor(Math.random() * candidates.length)];
      console.log(`   ✅ Selected: ${selectedMarket.market_id} - ${selectedMarket.question.substring(0, 50)}...`);
      console.log(`      Yes Odds: ${(selectedMarket.yes_odds * 100).toFixed(1)}%`);

      result.selectedMarket = {
        market_id: selectedMarket.market_id,
        question: selectedMarket.question,
        yes_odds: selectedMarket.yes_odds,
        end_date: selectedMarket.end_date,
      };

      // Step 3: Check orderbook and liquidity
      try {
        console.log(`📊 Checking orderbook for ${selectedMarket.market_id}...`);
        const { orderbook, liquidity, side } = await getOrderbookWithLiquidity(selectedMarket.market_id);
        
        result.steps.orderbookCheck = {
          success: true,
          liquidity,
          side,
          bestYesBid: orderbook.bestYesBid,
          bestYesAsk: orderbook.bestYesAsk,
        };

        if (liquidity < MIN_LIQUIDITY) {
          result.error = `Insufficient liquidity: ${liquidity} contracts < ${MIN_LIQUIDITY} required`;
          return res.status(400).json(result);
        }

        console.log(`   ✅ Liquidity: ${liquidity} contracts available`);
        console.log(`   Best Yes Ask: ${(orderbook.bestYesAsk * 100).toFixed(1)}¢`);

        // Step 4: Calculate contracts and execute order
        try {
          const contractPrice = orderbook.bestYesAsk || selectedMarket.yes_odds;
          const contractsToBuy = calculateContractAmount(TEST_AMOUNT, contractPrice);
          
          console.log(`💵 Executing order...`);
          console.log(`   Amount: $${TEST_AMOUNT}`);
          console.log(`   Price per contract: ${(contractPrice * 100).toFixed(1)}¢`);
          console.log(`   Contracts to buy: ${contractsToBuy.toFixed(2)}`);

          const order = await placeOrder({
            market: selectedMarket.market_id,
            side: 'YES',
            amount: contractsToBuy,
            price: contractPrice,
          });

          result.steps.orderExecution = {
            success: true,
            orderId: order.order_id || order.id,
            orderStatus: order.status,
            contracts: contractsToBuy,
            price: contractPrice,
            totalCost: TEST_AMOUNT,
            orderDetails: order,
          };

          result.success = true;
          console.log(`   ✅ Order placed successfully!`);
          console.log(`      Order ID: ${order.order_id || order.id}`);
          console.log(`      Status: ${order.status}`);

          return res.status(200).json(result);
        } catch (error: any) {
          result.steps.orderExecution = {
            success: false,
            error: error.message,
          };
          result.error = `Order execution failed: ${error.message}`;
          console.error(`   ❌ Order execution failed:`, error.message);
          return res.status(500).json(result);
        }
      } catch (error: any) {
        result.steps.orderbookCheck = {
          success: false,
          error: error.message,
        };
        result.error = `Orderbook check failed: ${error.message}`;
        console.error(`   ❌ Orderbook check failed:`, error.message);
        return res.status(500).json(result);
      }
    } catch (error: any) {
      result.steps.marketSearch = {
        success: false,
        error: error.message,
      };
      result.error = `Market search failed: ${error.message}`;
      console.error(`   ❌ Market search failed:`, error.message);
      return res.status(500).json(result);
    }
  } catch (error: any) {
    result.error = `Unexpected error: ${error.message}`;
    return res.status(500).json(result);
  }
}

