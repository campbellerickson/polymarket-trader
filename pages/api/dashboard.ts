import type { NextApiRequest, NextApiResponse } from 'next';
import { getRecentTrades, getOpenTrades, getCurrentBankroll, getInitialBankroll, getTradesInRange, getOpenPositions } from '../../lib/database/queries';
import { getMarket } from '../../lib/kalshi/client';
import { calculateWinRate, calculateTotalPnL } from '../../lib/utils/metrics';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all trades
    const allTrades = await getRecentTrades(1000);
    const resolvedTrades = allTrades.filter(t => t.status !== 'open');
    
    // Calculate metrics
    const currentBankroll = await getCurrentBankroll();
    const initialBankroll = await getInitialBankroll();
    const totalPnL = calculateTotalPnL(resolvedTrades);
    const totalReturn = initialBankroll > 0 ? (totalPnL / initialBankroll) * 100 : 0;
    const winRate = calculateWinRate(resolvedTrades);
    
    // Get open trades
    const openTrades = await getOpenTrades();
    
    // Get open positions with current odds
    const openPositions = await getOpenPositions();
    const positionsWithOdds = await Promise.all(
      openPositions.map(async (pos) => {
        try {
          const market = await getMarket(pos.trade.contract.market_id);
          const currentOdds = pos.trade.side === 'YES' ? market.yes_odds : market.no_odds;
          const currentValue = pos.trade.contracts_purchased * currentOdds;
          const unrealizedPnL = currentValue - pos.trade.position_size;
          const unrealizedPnLPct = (unrealizedPnL / pos.trade.position_size) * 100;
          
          return {
            ...pos,
            current_odds: currentOdds,
            unrealized_pnl: unrealizedPnL,
            unrealized_pnl_pct: unrealizedPnLPct,
          };
        } catch (error) {
          // If we can't fetch market, use entry odds
          return {
            ...pos,
            current_odds: pos.trade.entry_odds,
            unrealized_pnl: 0,
            unrealized_pnl_pct: 0,
          };
        }
      })
    );
    
    // Calculate MTD
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mtdTrades = await getTradesInRange(monthStart, now);
    const mtdResolved = mtdTrades.filter(t => t.status !== 'open');
    const mtdPnL = calculateTotalPnL(mtdResolved);
    const mtdStartBankroll = await getInitialBankroll(); // Simplified
    const mtdReturn = mtdStartBankroll > 0 ? (mtdPnL / mtdStartBankroll) * 100 : 0;
    
    // Calculate YTD
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const ytdTrades = await getTradesInRange(yearStart, now);
    const ytdResolved = ytdTrades.filter(t => t.status !== 'open');
    const ytdPnL = calculateTotalPnL(ytdResolved);
    const ytdReturn = initialBankroll > 0 ? (ytdPnL / initialBankroll) * 100 : 0;
    
    // Get recent trades (last 20)
    const recentTrades = allTrades.slice(0, 20);
    
    return res.status(200).json({
      currentBankroll,
      initialBankroll,
      totalPnL,
      totalReturn,
      winRate,
      totalTrades: allTrades.length,
      openTrades: openTrades.length,
      mtdPnL,
      mtdReturn,
      ytdPnL,
      ytdReturn,
      recentTrades,
      openPositions: positionsWithOdds,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
