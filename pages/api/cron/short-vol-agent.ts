import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAndResolveOpenTrades } from '../../../lib/kalshi/resolver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // STEP 1: Cancel stale orders first (>50 minutes old) to free up cash
    console.log('🧹 Canceling stale orders (>50 min)...');
    const cancelledCount = await cancelStaleOrders();
    console.log(`   Cancelled ${cancelledCount} stale orders`);

    // STEP 2: Check balance (after cancelling to get accurate available cash)
    const { getAccountBalance } = await import('../../../lib/kalshi/client');
    const liveBalance = await getAccountBalance();
    console.log(`💵 Live balance: $${liveBalance.toFixed(2)}`);

    if (liveBalance < 5) {
      console.log(`⚠️ Insufficient funds for trading (need at least $5)`);
      console.log(`⏭️ Ending cron job early`);
      return res.status(200).json({
        success: true,
        resolvedCount: 0,
        availableCash: liveBalance,
        cancelledOrders: cancelledCount,
        reinvestment: { attempted: false, reason: 'insufficient_funds' }
      });
    }

    console.log('🔍 Checking for resolved trades...');
    const result = await checkAndResolveOpenTrades();

    // If we should trigger a new trade (cash > $20), execute trading logic
    if (result.shouldTriggerTrade) {
      console.log('\n🎯 Triggering new trade with available cash...');

      const { scanContracts } = await import('../../../lib/kalshi/scanner');
      const { analyzeContracts } = await import('../../../lib/ai/analyzer');
      const { executeTrades } = await import('../../../lib/kalshi/executor');
      const { getCurrentBankroll } = await import('../../../lib/database/queries');
      const { TRADING_CONSTANTS } = await import('../../../config/constants');

      // 1. First, run screen-markets to refresh the market cache
      console.log('📊 Refreshing market cache...');
      try {
        const { KalshiMarketScreener } = await import('../../../lib/kalshi/screener');
        const { cacheMarkets } = await import('../../../lib/kalshi/cache');

        const screener = new KalshiMarketScreener();
        const screenedMarkets = await screener.screenMarkets({
          minVolume24h: 2000,
          minOpenInterest: 2000,
          orderSize: 100,
          topNForDepthCheck: 15,
          minOdds: TRADING_CONSTANTS.MIN_ODDS,
          maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
        });

        if (screenedMarkets.length > 0) {
          await cacheMarkets(screenedMarkets);
        }
        console.log(`✅ Market cache refreshed with ${screenedMarkets.length} markets`);
      } catch (screenError: any) {
        console.error('⚠️ Failed to refresh market cache:', screenError.message);
        // Continue anyway - we might have stale cache
      }

      // 2. Scan for contracts
      const contracts = await scanContracts({
        minOdds: TRADING_CONSTANTS.MIN_ODDS,
        maxOdds: TRADING_CONSTANTS.MAX_ODDS,
        maxDaysToResolution: TRADING_CONSTANTS.MAX_DAYS_TO_RESOLUTION,
        minLiquidity: TRADING_CONSTANTS.MIN_LIQUIDITY,
        excludeCategories: TRADING_CONSTANTS.EXCLUDE_CATEGORIES,
      });

      console.log(`📊 Found ${contracts.length} qualifying contracts`);

      if (contracts.length === 0) {
        console.log(`⚠️ No qualifying contracts found for reinvestment.`);
        return res.status(200).json({
          success: true,
          resolvedCount: result.resolvedCount,
          availableCash: result.availableCash,
          reinvestment: { attempted: true, executed: false, reason: 'no_contracts' }
        });
      }

      // 3. Execute trades with retry logic
      let availableContracts = contracts;
      let failedMarketIds: string[] = [];
      let allTradeResults: any[] = [];
      let remainingBudget = result.availableCash;
      const MAX_RETRIES = 2;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        console.log(`\n🎯 Trading attempt ${attempt + 1}/${MAX_RETRIES}`);

        // Get AI analysis (exclude previously failed markets)
        const analysis = await analyzeContracts({
          contracts: availableContracts,
          historicalPerformance: [],
          currentBankroll: await getCurrentBankroll(),
          dailyBudget: remainingBudget,
        });

        console.log(`🤖 AI selected ${analysis.selectedContracts.length} contracts`);

        if (analysis.selectedContracts.length === 0) {
          console.log(`⚠️ No contracts selected by AI`);
          break;
        }

        // Execute trades
        const tradeResults = await executeTrades(analysis);
        allTradeResults.push(...tradeResults);

        const successful = tradeResults.filter(r => r.success);
        const failed = tradeResults.filter(r => !r.success);

        console.log(`   ✅ ${successful.length} succeeded, ❌ ${failed.length} failed`);

        // If all succeeded, we're done
        if (failed.length === 0) {
          console.log(`✅ All trades succeeded!`);
          break;
        }

        // Track failed markets and calculate remaining budget
        for (const result of failed) {
          if (result.contract) {
            failedMarketIds.push(result.contract.market_id);
          }
        }

        // Calculate how much budget we still have (failed trades didn't spend)
        const spentBudget = successful.reduce((sum, r) => sum + (r.trade?.position_size || 0), 0);
        remainingBudget = result.availableCash - spentBudget;

        console.log(`   💰 Remaining budget: $${remainingBudget.toFixed(2)}`);

        // If no budget left or no more contracts, stop
        if (remainingBudget < 5 || failed.length === 0) {
          break;
        }

        // Exclude failed markets for next attempt
        availableContracts = contracts.filter(c => !failedMarketIds.includes(c.market_id));
        console.log(`   🔄 Retrying with ${availableContracts.length} remaining contracts (excluded ${failedMarketIds.length} failed markets)`);

        if (availableContracts.length === 0) {
          console.log(`⚠️ No more contracts to try`);
          break;
        }
      }

      const successfulTrades = allTradeResults.filter(r => r.success).length;
      const totalAllocated = allTradeResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.trade?.position_size || 0), 0);

      return res.status(200).json({
        success: true,
        resolvedCount: result.resolvedCount,
        availableCash: result.availableCash,
        cancelledOrders: cancelledCount,
        reinvestment: {
          attempted: true,
          executed: successfulTrades > 0,
          tradesExecuted: successfulTrades,
          totalAllocated: totalAllocated,
          failedMarkets: failedMarketIds.length
        }
      });
    }

    return res.status(200).json({
      success: true,
      resolvedCount: result.resolvedCount,
      availableCash: result.availableCash,
      cancelledOrders: cancelledCount,
      reinvestment: { attempted: false }
    });
  } catch (error: any) {
    console.error('❌ Resolution check failed:', error);
    const { logCronError } = await import('../../../lib/utils/logger');
    await logCronError('check-resolutions', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Cancel stale orders (>50 minutes old) to free up cash
 * Orders that don't fill within 50 minutes are unlikely to fill at all
 */
async function cancelStaleOrders(): Promise<number> {
  const { supabase } = await import('../../../lib/database/client');
  const { getOrdersApi } = await import('../../../lib/kalshi/client');

  const fiftyMinutesAgo = Date.now() - (50 * 60 * 1000);

  try {
    const ordersApi = getOrdersApi();

    // Get ALL orders from Kalshi (including resting ones)
    const { data: allOrders } = await ordersApi.getOrders();
    const orders = (allOrders as any).orders || [];

    // Filter for resting orders that are >50 minutes old
    const staleOrders = orders.filter((o: any) => {
      if (o.status !== 'resting') return false;
      const createdTime = new Date(o.created_time).getTime();
      return (Date.now() - createdTime) > (50 * 60 * 1000);
    });

    if (staleOrders.length === 0) {
      return 0;
    }

    console.log(`   Found ${staleOrders.length} stale orders to cancel`);
    let cancelled = 0;

    for (const order of staleOrders) {
      try {
        console.log(`   Canceling: ${order.ticker} (${order.order_id})`);
        await ordersApi.cancelOrder(order.order_id);

        // Try to find and update the trade in database (best effort)
        const { data: trades } = await supabase
          .from('trades')
          .select('id, contract:contracts(market_id)')
          .eq('status', 'open');

        const matchingTrade = trades?.find((t: any) => t.contract?.market_id === order.ticker);

        if (matchingTrade) {
          await supabase
            .from('trades')
            .update({
              status: 'cancelled',
              exit_odds: null,
              pnl: 0,
              resolved_at: new Date().toISOString(),
            })
            .eq('id', matchingTrade.id);
        }

        cancelled++;
      } catch (error: any) {
        console.error(`   ⚠️ Error canceling ${order.order_id}:`, error.message);
        continue;
      }
    }

    return cancelled;
  } catch (error: any) {
    console.error(`   ⚠️ Failed to check for stale orders:`, error.message);
    return 0;
  }
}

