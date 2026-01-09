import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAndResolveOpenTrades } from '../../../lib/kalshi/resolver';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // STEP 1: Cancel stale orders first (>1 hour old) to free up cash
    console.log('🧹 Canceling stale orders...');
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

      // 3. Get AI analysis (use available cash as budget)
      const analysis = await analyzeContracts({
        contracts,
        historicalPerformance: [],
        currentBankroll: await getCurrentBankroll(),
        dailyBudget: result.availableCash, // Use available cash as budget
      });

      console.log(`🤖 AI selected ${analysis.selectedContracts.length} contracts for reinvestment`);

      // 4. Execute trades if AI selected any
      if (analysis.selectedContracts.length > 0) {
        const tradeResults = await executeTrades(analysis);
        console.log(`✅ Executed ${tradeResults.filter(r => r.success).length}/${tradeResults.length} reinvestment trades`);

        return res.status(200).json({
          success: true,
          resolvedCount: result.resolvedCount,
          availableCash: result.availableCash,
          reinvestment: {
            attempted: true,
            executed: true,
            tradesExecuted: tradeResults.filter(r => r.success).length,
            totalAllocated: analysis.totalAllocated
          }
        });
      }
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
 * Cancel stale orders (>1 hour old) to free up cash
 * Orders that don't fill within 1 hour are unlikely to fill at all
 */
async function cancelStaleOrders(): Promise<number> {
  const { supabase } = await import('../../../lib/database/client');
  const { getOrdersApi } = await import('../../../lib/kalshi/client');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Get all open trades older than 1 hour
  const { data: openTrades, error } = await supabase
    .from('trades')
    .select('*, contract:contracts(*)')
    .eq('status', 'open')
    .lt('executed_at', oneHourAgo.toISOString());

  if (error || !openTrades || openTrades.length === 0) {
    return 0;
  }

  const ordersApi = getOrdersApi();
  let cancelled = 0;

  for (const trade of openTrades) {
    try {
      // Get all orders from Kalshi
      const { data: allOrders } = await ordersApi.getOrders();
      const orders = (allOrders as any).orders || [];

      // Find this trade's order (matched by ticker and created time)
      const order = orders.find((o: any) =>
        o.ticker === trade.contract?.market_id &&
        new Date(o.created_time) >= new Date(trade.executed_at) &&
        new Date(o.created_time) <= new Date(new Date(trade.executed_at).getTime() + 60000)
      );

      if (!order) continue;

      // If order is still resting (not filled), cancel it
      if (order.status === 'resting') {
        console.log(`   Canceling stale order for ${trade.contract.question.substring(0, 40)}...`);
        await ordersApi.cancelOrder(order.order_id);

        // Mark trade as cancelled in database
        await supabase
          .from('trades')
          .update({
            status: 'cancelled',
            exit_odds: null,
            pnl: 0,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        cancelled++;
      }
    } catch (error: any) {
      console.error(`   ⚠️ Error canceling order for trade ${trade.id}:`, error.message);
      continue;
    }
  }

  return cancelled;
}

