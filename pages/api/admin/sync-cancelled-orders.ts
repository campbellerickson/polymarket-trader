import type { NextApiRequest, NextApiResponse } from 'next';
import { getOrdersApi } from '../../../lib/kalshi/client';
import { supabase } from '../../../lib/database/client';

/**
 * Sync cancelled orders from Kalshi to database
 * Updates trades table to mark cancelled orders correctly
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔄 Syncing cancelled orders from Kalshi to database...');

  try {
    // Get all cancelled orders from Kalshi
    const ordersApi = getOrdersApi();
    const response = await ordersApi.getOrders();
    const orders = (response.data as any).orders || [];

    const cancelledOrders = orders.filter((o: any) =>
      o.status === 'canceled' || o.status === 'cancelled'
    );

    console.log(`Found ${cancelledOrders.length} cancelled orders on Kalshi`);

    // Get all open trades from database
    const { data: openTrades, error } = await supabase
      .from('trades')
      .select('*, contract:contracts(*)')
      .eq('status', 'open');

    if (error) {
      throw new Error(`Failed to fetch open trades: ${error.message}`);
    }

    console.log(`Found ${openTrades?.length || 0} open trades in database`);

    let updated = 0;

    // Match cancelled orders to open trades and update
    for (const trade of (openTrades || [])) {
      // Find matching cancelled order (by market_id and approximate time)
      const matchingOrder = cancelledOrders.find((order: any) => {
        const orderTime = new Date(order.created_time).getTime();
        const tradeTime = new Date(trade.executed_at).getTime();
        const timeDiff = Math.abs(orderTime - tradeTime);

        return (
          order.ticker === trade.contract.market_id &&
          timeDiff < 60000 // Within 1 minute
        );
      });

      if (matchingOrder) {
        console.log(`Updating trade ${trade.id} to cancelled`);

        const { error: updateError } = await supabase
          .from('trades')
          .update({
            status: 'cancelled',
            exit_odds: null,
            pnl: 0,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', trade.id);

        if (updateError) {
          console.error(`Failed to update trade ${trade.id}:`, updateError.message);
        } else {
          updated++;
        }
      }
    }

    console.log(`✅ Updated ${updated} trades to cancelled status`);

    return res.status(200).json({
      success: true,
      cancelled_orders: cancelledOrders.length,
      trades_updated: updated,
    });

  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    return res.status(500).json({
      error: error.message,
    });
  }
}
