import type { NextApiRequest, NextApiResponse } from 'next';
import { monitorStopLosses } from '../../../lib/trading/stop-loss';
import { getMarket, getOrdersApi, getPortfolioPositions } from '../../../lib/kalshi/client';
import { supabase } from '../../../lib/database/client';

/**
 * Consolidated sync job - runs every 15 minutes
 *
 * Every run (15 min):
 * - Stop-loss monitoring
 * - Check order fills
 * - Reconcile database positions with Kalshi
 *
 * Once per day (3 AM only):
 * - Cleanup resolved trades
 * - Sync order statuses
 * - Sync outcomes to ai_decisions
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentHour = new Date().getHours();
  const isDailyRun = currentHour === 3; // Run daily tasks at 3 AM

  console.log(`🔄 Running sync job (${isDailyRun ? 'DAILY' : 'REGULAR'} mode)...`);

  const results: any = {
    stopLoss: null,
    checkFills: null,
    cleanup: null,
    syncOrders: null,
    syncOutcomes: null,
    reconcile: null,
  };

  try {
    // ===== EVERY RUN: Stop-Loss Monitoring =====
    console.log('\n🛡️ Running stop loss monitor...');
    try {
      const stopLossResult = await monitorStopLosses();
      results.stopLoss = {
        success: true,
        triggered: stopLossResult.triggered,
      };
      console.log(`✅ Stop loss complete: ${stopLossResult.triggered} triggered`);
    } catch (error: any) {
      console.error('❌ Stop loss failed:', error.message);
      results.stopLoss = { success: false, error: error.message };
    }

    // ===== EVERY RUN: Check Order Fills =====
    console.log('\n📦 Checking order fills...');
    try {
      const fillsResult = await checkOrderFills();
      results.checkFills = fillsResult;
      console.log(`✅ Check fills complete: ${fillsResult.filled} filled, ${fillsResult.cancelled} cancelled`);
    } catch (error: any) {
      console.error('❌ Check fills failed:', error.message);
      results.checkFills = { success: false, error: error.message };
    }

    // ===== EVERY RUN: Reconcile Database with Kalshi Positions =====
    console.log('\n🔄 Reconciling database with Kalshi positions...');
    try {
      const reconcileResult = await reconcilePositions();
      results.reconcile = reconcileResult;
      console.log(`✅ Reconciliation complete: ${reconcileResult.reconciled} trades updated`);
    } catch (error: any) {
      console.error('❌ Reconciliation failed:', error.message);
      results.reconcile = { success: false, error: error.message };
    }

    // ===== EVERY RUN: Sync Outcomes to AI =====
    console.log('\n🎯 Syncing outcomes to ai_decisions...');
    try {
      const syncOutcomesResult = await syncOutcomesToAI();
      results.syncOutcomes = syncOutcomesResult;
      console.log(`✅ Sync outcomes complete: ${syncOutcomesResult.synced} synced`);
    } catch (error: any) {
      console.error('❌ Sync outcomes failed:', error.message);
      results.syncOutcomes = { success: false, error: error.message };
    }

    // ===== DAILY ONLY: Cleanup Resolved Trades =====
    if (isDailyRun) {
      console.log('\n🧹 Running daily cleanup...');
      try {
        const cleanupResult = await cleanupResolvedTrades();
        results.cleanup = cleanupResult;
        console.log(`✅ Cleanup complete: ${cleanupResult.cleaned} trades cleaned`);
      } catch (error: any) {
        console.error('❌ Cleanup failed:', error.message);
        results.cleanup = { success: false, error: error.message };
      }

      console.log('\n📋 Syncing order statuses...');
      try {
        const syncOrdersResult = await syncOrderStatuses();
        results.syncOrders = syncOrdersResult;
        console.log(`✅ Sync orders complete: ${syncOrdersResult.synced} synced`);
      } catch (error: any) {
        console.error('❌ Sync orders failed:', error.message);
        results.syncOrders = { success: false, error: error.message };
      }
    }

    return res.status(200).json({
      success: true,
      mode: isDailyRun ? 'daily' : 'regular',
      results,
    });

  } catch (error: any) {
    console.error('❌ Sync job failed:', error);
    return res.status(500).json({
      error: error.message,
      results,
    });
  }
}

// ===== CHECK ORDER FILLS =====
async function checkOrderFills() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: openTrades, error } = await supabase
    .from('trades')
    .select('*, contract:contracts(*)')
    .eq('status', 'open')
    .gte('executed_at', sevenDaysAgo.toISOString())
    .order('executed_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch open trades: ${error.message}`);

  if (!openTrades || openTrades.length === 0) {
    return { success: true, filled: 0, cancelled: 0, still_open: 0 };
  }

  const ordersApi = getOrdersApi();
  let filled = 0, cancelled = 0, still_open = 0;

  for (const trade of openTrades) {
    try {
      const market = await getMarket(trade.contract.market_id);

      if (market.resolved) {
        const won = market.outcome === trade.side;
        const pnl = won
          ? (trade.contracts_purchased * 1.0) - trade.position_size
          : -trade.position_size;

        await supabase
          .from('trades')
          .update({
            status: won ? 'won' : 'lost',
            exit_odds: market.final_odds || (trade.side === 'YES' ? market.yes_odds : market.no_odds),
            pnl,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        filled++;
        continue;
      }

      const { data: allOrders } = await ordersApi.getOrders();
      const orders = (allOrders as any).orders || [];

      const order = orders.find((o: any) =>
        o.ticker === trade.contract?.market_id &&
        new Date(o.created_time) >= new Date(trade.executed_at) &&
        new Date(o.created_time) <= new Date(new Date(trade.executed_at).getTime() + 60000)
      );

      if (!order) {
        continue;
      }

      if (order.status === 'filled' || order.remaining_count === 0) {
        filled++;
        continue;
      }

      if (order.status === 'canceled' || order.status === 'cancelled') {
        await supabase
          .from('trades')
          .update({ status: 'cancelled', exit_odds: null, pnl: 0, resolved_at: new Date().toISOString() })
          .eq('id', trade.id);
        cancelled++;
        continue;
      }

      // Just track status - cancellation is handled by trader job
      still_open++;
    } catch (error: any) {
      console.error(`Error checking trade ${trade.id}:`, error.message);
      continue;
    }
  }

  return { success: true, filled, cancelled, still_open };
}

// ===== CLEANUP RESOLVED TRADES =====
async function cleanupResolvedTrades() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('trades')
    .delete()
    .in('status', ['won', 'lost', 'stopped', 'cancelled'])
    .lt('resolved_at', thirtyDaysAgo.toISOString())
    .select();

  if (error) throw new Error(`Cleanup failed: ${error.message}`);

  return { success: true, cleaned: data?.length || 0 };
}

// ===== SYNC ORDER STATUSES =====
async function syncOrderStatuses() {
  const { data: recentTrades, error } = await supabase
    .from('trades')
    .select('*')
    .gte('executed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('executed_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to fetch trades: ${error.message}`);

  const ordersApi = getOrdersApi();
  const { data: allOrders } = await ordersApi.getOrders();
  const orders = (allOrders as any).orders || [];

  let synced = 0;

  for (const trade of recentTrades || []) {
    const order = orders.find((o: any) =>
      o.ticker === trade.contract?.market_id &&
      new Date(o.created_time) >= new Date(trade.executed_at) &&
      new Date(o.created_time) <= new Date(new Date(trade.executed_at).getTime() + 60000)
    );

    if (order) {
      await supabase
        .from('trades')
        .update({ kalshi_order_id: order.order_id })
        .eq('id', trade.id);
      synced++;
    }
  }

  return { success: true, synced };
}

// ===== SYNC OUTCOMES TO AI DECISIONS =====
async function syncOutcomesToAI() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: decisions, error } = await supabase
    .from('ai_decisions')
    .select('id, contract_snapshot, side, allocated_amount')
    .is('outcome', null)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(100);

  if (error) throw new Error(`Failed to fetch ai_decisions: ${error.message}`);

  let synced = 0;

  for (const decision of decisions || []) {
    try {
      const marketId = decision.contract_snapshot?.market_id;
      if (!marketId) continue;

      const market = await getMarket(marketId);

      if (market.resolved && market.outcome) {
        // Determine if AI prediction was correct
        // If AI bet YES and market resolved YES → won
        // If AI bet YES and market resolved NO → lost
        // If AI bet NO and market resolved NO → won
        // If AI bet NO and market resolved YES → lost
        const aiSide = decision.side || 'YES'; // Default to YES if not specified
        const marketOutcome = market.outcome; // 'yes' or 'no' from Kalshi

        const wasCorrect = (
          (aiSide === 'YES' && marketOutcome.toLowerCase() === 'yes') ||
          (aiSide === 'NO' && marketOutcome.toLowerCase() === 'no')
        );

        await supabase
          .from('ai_decisions')
          .update({
            outcome: wasCorrect ? 'won' : 'lost',
            resolution_source: 'sync-job',
            resolved_at: market.resolved_at || new Date().toISOString(),
          })
          .eq('id', decision.id);

        synced++;
      }
    } catch (error: any) {
      console.error(`Error syncing decision ${decision.id}:`, error.message);
      continue;
    }
  }

  return { success: true, synced };
}

// ===== RECONCILE DATABASE WITH KALSHI POSITIONS =====
async function reconcilePositions() {
  console.log('📊 Fetching actual positions from Kalshi...');
  const kalshiPositions = await getPortfolioPositions();

  // Get all open trades from database
  const { data: openTrades, error } = await supabase
    .from('trades')
    .select('*, contract:contracts(*)')
    .eq('status', 'open');

  if (error) throw new Error(`Failed to fetch open trades: ${error.message}`);

  const dbCount = openTrades?.length || 0;
  const kalshiCount = kalshiPositions.length;

  console.log(`   Database: ${dbCount} open trades`);
  console.log(`   Kalshi: ${kalshiCount} positions`);

  let reconciled = 0;

  // Build map of Kalshi positions by ticker
  const kalshiMap = new Map();
  for (const position of kalshiPositions) {
    kalshiMap.set(position.ticker, position);
  }

  // Check each database trade against Kalshi positions
  for (const trade of openTrades || []) {
    const kalshiPosition = kalshiMap.get(trade.contract.market_id);

    // If position doesn't exist in Kalshi, mark as cancelled
    if (!kalshiPosition) {
      console.log(`   ⚠️ Trade ${trade.id} (${trade.contract.market_id}) not found in Kalshi - marking as cancelled`);

      await supabase
        .from('trades')
        .update({
          status: 'cancelled',
          exit_odds: null,
          pnl: 0,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', trade.id);

      reconciled++;
    }
  }

  return { success: true, reconciled };
}
