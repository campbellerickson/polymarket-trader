import type { NextApiRequest, NextApiResponse } from 'next';
import { getRecentTrades, getInitialBankroll, getTradesInRange } from '../../lib/database/queries';
import { getAccountBalance } from '../../lib/kalshi/client';
import { calculateWinRate, calculateTotalPnL } from '../../lib/utils/metrics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 Dashboard: Fetching performance data...');

    // Get LIVE account balance from Kalshi API
    let currentBankroll: number;
    try {
      currentBankroll = await getAccountBalance();
      console.log(`   ✅ Live Kalshi balance: $${currentBankroll.toFixed(2)}`);
    } catch (error) {
      console.warn('   ⚠️ Failed to fetch live balance:', error);
      throw new Error('Unable to fetch account balance from Kalshi');
    }

    const initialBankroll = await getInitialBankroll();

    // Get all resolved trades (exclude open and cancelled)
    const allTrades = await getRecentTrades(1000);
    const resolvedTrades = allTrades.filter(t =>
      t.status === 'won' || t.status === 'lost' || t.status === 'stopped'
    );

    // Overall Performance
    const totalPnL = calculateTotalPnL(resolvedTrades);
    const totalReturn = initialBankroll > 0 ? (totalPnL / initialBankroll) * 100 : 0;
    const winRate = calculateWinRate(resolvedTrades);

    console.log(`   Overall: $${totalPnL.toFixed(2)} P&L (${totalReturn.toFixed(2)}%)`);
    console.log(`   Win rate: ${winRate.toFixed(1)}% (${resolvedTrades.length} trades)`);

    // Today's Performance
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTrades = await getTradesInRange(todayStart, new Date());
    const todayResolved = todayTrades.filter(t =>
      t.status === 'won' || t.status === 'lost' || t.status === 'stopped'
    );
    const todayPnL = calculateTotalPnL(todayResolved);

    // Week Performance (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekTrades = await getTradesInRange(weekAgo, new Date());
    const weekResolved = weekTrades.filter(t =>
      t.status === 'won' || t.status === 'lost' || t.status === 'stopped'
    );
    const weekPnL = calculateTotalPnL(weekResolved);

    // Month-to-Date Performance
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const mtdTrades = await getTradesInRange(monthStart, new Date());
    const mtdResolved = mtdTrades.filter(t =>
      t.status === 'won' || t.status === 'lost' || t.status === 'stopped'
    );
    const mtdPnL = calculateTotalPnL(mtdResolved);
    const mtdReturn = initialBankroll > 0 ? (mtdPnL / initialBankroll) * 100 : 0;

    // Year-to-Date Performance
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const ytdTrades = await getTradesInRange(yearStart, new Date());
    const ytdResolved = ytdTrades.filter(t =>
      t.status === 'won' || t.status === 'lost' || t.status === 'stopped'
    );
    const ytdPnL = calculateTotalPnL(ytdResolved);
    const ytdReturn = initialBankroll > 0 ? (ytdPnL / initialBankroll) * 100 : 0;

    console.log(`   MTD: $${mtdPnL.toFixed(2)} (${mtdResolved.length} trades)`);
    console.log(`   YTD: $${ytdPnL.toFixed(2)} (${ytdResolved.length} trades)`);
    console.log('✅ Dashboard data ready');

    return res.status(200).json({
      // Current balance
      currentBankroll,
      initialBankroll,

      // Overall performance
      totalPnL,
      totalReturn,
      winRate,
      totalTrades: resolvedTrades.length,

      // Performance over time
      today: {
        pnl: todayPnL,
        trades: todayResolved.length,
      },
      week: {
        pnl: weekPnL,
        trades: weekResolved.length,
      },
      mtd: {
        pnl: mtdPnL,
        return: mtdReturn,
        trades: mtdResolved.length,
      },
      ytd: {
        pnl: ytdPnL,
        return: ytdReturn,
        trades: ytdResolved.length,
      },

      // Metadata
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
