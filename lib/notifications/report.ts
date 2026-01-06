import { DailyReportData, Position } from '../../types';
import { getTradesToday, getTradesInRange, getOpenPositions, getCashBalance, getCurrentBankroll, getInitialBankroll, getBankrollAt } from '../database/queries';
import { getMarket } from '../kalshi/client';

export async function generateDailyReport(): Promise<DailyReportData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  
  // Get today's trades
  const tradesExecuted = await getTradesToday();
  const totalInvested = tradesExecuted.reduce((sum, t) => sum + t.position_size, 0);
  
  // Get open positions with current odds
  const openTrades = await getOpenPositions();
  const openPositions: Position[] = [];
  let openPositionsValue = 0;
  
  for (const pos of openTrades) {
    try {
      const market = await getMarket(pos.trade.contract.market_id);
      const currentOdds = pos.trade.side === 'YES' ? market.yes_odds : market.no_odds;
      const currentValue = pos.trade.contracts_purchased * currentOdds;
      const unrealizedPnL = currentValue - pos.trade.position_size;
      const unrealizedPnLPct = (unrealizedPnL / pos.trade.position_size) * 100;
      
      openPositions.push({
        ...pos,
        current_odds: currentOdds,
        unrealized_pnl: unrealizedPnL,
        unrealized_pnl_pct: unrealizedPnLPct,
      });
      
      openPositionsValue += currentValue;
    } catch (error) {
      // If we can't fetch market, use entry odds
      openPositionsValue += pos.trade.position_size;
    }
  }
  
  // Get cash balance
  const cashBalance = await getCashBalance();
  const totalLiquidity = cashBalance + openPositionsValue;
  
  // MTD metrics
  const mtdTrades = await getTradesInRange(monthStart, today);
  const mtdResolved = mtdTrades.filter(t => t.status !== 'open');
  const mtdPnL = mtdResolved.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const mtdWins = mtdResolved.filter(t => t.status === 'won').length;
  const mtdWinRate = mtdResolved.length > 0 ? mtdWins / mtdResolved.length : 0;
  
  // Calculate MTD return %
  const mtdStartBankroll = await getBankrollAt(monthStart);
  const mtdReturnPct = mtdStartBankroll > 0 ? (mtdPnL / mtdStartBankroll) * 100 : 0;
  
  // YTD metrics
  const ytdTrades = await getTradesInRange(yearStart, today);
  const ytdResolved = ytdTrades.filter(t => t.status !== 'open');
  const ytdPnL = ytdResolved.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const ytdWins = ytdResolved.filter(t => t.status === 'won').length;
  const ytdWinRate = ytdResolved.length > 0 ? ytdWins / ytdResolved.length : 0;
  
  // Calculate YTD return %
  const initialBankroll = await getInitialBankroll();
  const ytdReturnPct = initialBankroll > 0 ? (ytdPnL / initialBankroll) * 100 : 0;
  
  return {
    reportDate: today,
    tradesExecuted,
    totalInvested,
    openPositions,
    openPositionsValue,
    cashBalance,
    totalLiquidity,
    mtdPnL,
    mtdReturnPct,
    mtdWinRate,
    mtdTrades: mtdResolved.length,
    ytdPnL,
    ytdReturnPct,
    ytdWinRate,
    ytdTrades: ytdResolved.length,
    currentBankroll: totalLiquidity,
    initialBankroll
  };
}

export function formatReportForSMS(data: DailyReportData): string {
  const emoji = data.mtdPnL >= 0 ? '📈' : '📉';
  
  return `
${emoji} Kalshi Daily Report - ${data.reportDate.toLocaleDateString()}

💰 LIQUIDITY
Cash: $${data.cashBalance.toFixed(2)}
Invested: $${data.openPositionsValue.toFixed(2)}
Total: $${data.totalLiquidity.toFixed(2)}

📊 TODAY'S ACTIVITY
Trades: ${data.tradesExecuted.length}
Invested: $${data.totalInvested.toFixed(2)}
${data.tradesExecuted.map(t => 
  `• ${truncate(t.contract.question, 40)} - $${t.position_size.toFixed(0)} @ ${(t.entry_odds * 100).toFixed(1)}%`
).join('\n')}

📅 MTD PERFORMANCE
P&L: ${formatPnL(data.mtdPnL)}
Return: ${data.mtdReturnPct >= 0 ? '+' : ''}${data.mtdReturnPct.toFixed(2)}%
Win Rate: ${(data.mtdWinRate * 100).toFixed(1)}% (${data.mtdTrades} trades)

📆 YTD PERFORMANCE
P&L: ${formatPnL(data.ytdPnL)}
Return: ${data.ytdReturnPct >= 0 ? '+' : ''}${data.ytdReturnPct.toFixed(2)}%
Win Rate: ${(data.ytdWinRate * 100).toFixed(1)}% (${data.ytdTrades} trades)

🎯 OPEN POSITIONS: ${data.openPositions.length}
${data.openPositions.slice(0, 3).map(p => 
  `• ${truncate(p.trade.contract.question, 35)} - $${p.trade.position_size.toFixed(0)}`
).join('\n')}${data.openPositions.length > 3 ? `\n...+${data.openPositions.length - 3} more` : ''}
  `.trim();
}

export function formatReportForEmail(data: DailyReportData): string {
  const emoji = data.mtdPnL >= 0 ? '📈' : '📉';
  const mtdColor = data.mtdPnL >= 0 ? '#10b981' : '#ef4444';
  const ytdColor = data.ytdPnL >= 0 ? '#10b981' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .section { background: #f8fafc; padding: 20px; margin: 10px 0; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .trade-item { padding: 10px; margin: 5px 0; background: white; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} Kalshi Daily Report</h1>
      <p>${data.reportDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    
    <div class="section">
      <h2>💰 Current Liquidity</h2>
      <div class="metric">
        <div class="metric-label">Cash Balance</div>
        <div class="metric-value">$${data.cashBalance.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Invested</div>
        <div class="metric-value">$${data.openPositionsValue.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Total Liquidity</div>
        <div class="metric-value">$${data.totalLiquidity.toFixed(2)}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📊 Today's Activity</h2>
      <p><strong>${data.tradesExecuted.length} trades executed</strong> • $${data.totalInvested.toFixed(2)} invested</p>
      ${data.tradesExecuted.map(t => `
        <div class="trade-item">
          <strong>${t.contract.question}</strong><br/>
          $${t.position_size.toFixed(2)} @ ${(t.entry_odds * 100).toFixed(1)}% odds
          <span style="color: #64748b;">• Confidence: ${(t.ai_confidence * 100).toFixed(0)}%</span><br/>
          <small style="color: #64748b;">${t.ai_reasoning}</small>
        </div>
      `).join('')}
      ${data.tradesExecuted.length === 0 ? '<p style="color: #64748b;">No trades executed today</p>' : ''}
    </div>
    
    <div class="section">
      <h2>📅 Month-to-Date Performance</h2>
      <div class="metric">
        <div class="metric-label">P&L</div>
        <div class="metric-value" style="color: ${mtdColor};">
          ${data.mtdPnL >= 0 ? '+' : ''}$${data.mtdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${mtdColor};">
          ${data.mtdReturnPct >= 0 ? '+' : ''}${data.mtdReturnPct.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${(data.mtdWinRate * 100).toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${data.mtdTrades}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📆 Year-to-Date Performance</h2>
      <div class="metric">
        <div class="metric-label">P&L</div>
        <div class="metric-value" style="color: ${ytdColor};">
          ${data.ytdPnL >= 0 ? '+' : ''}$${data.ytdPnL.toFixed(2)}
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Return</div>
        <div class="metric-value" style="color: ${ytdColor};">
          ${data.ytdReturnPct >= 0 ? '+' : ''}${data.ytdReturnPct.toFixed(2)}%
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Win Rate</div>
        <div class="metric-value">${(data.ytdWinRate * 100).toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">${data.ytdTrades}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>🎯 Open Positions (${data.openPositions.length})</h2>
      ${data.openPositions.map(p => {
        const unrealizedPnL = p.unrealized_pnl;
        const unrealizedPct = p.unrealized_pnl_pct;
        return `
        <div class="trade-item">
          <strong>${p.trade.contract.question}</strong><br/>
          Entry: $${p.trade.position_size.toFixed(2)} @ ${(p.trade.entry_odds * 100).toFixed(1)}%
          • Current: ${(p.current_odds * 100).toFixed(1)}%<br/>
          Unrealized P&L: <span style="color: ${unrealizedPnL >= 0 ? '#10b981' : '#ef4444'};">
            ${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)} (${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(1)}%)
          </span><br/>
          <small style="color: #64748b;">Resolves: ${new Date(p.trade.contract.end_date).toLocaleDateString()}</small>
        </div>
        `;
      }).join('')}
      ${data.openPositions.length === 0 ? '<p style="color: #64748b;">No open positions</p>' : ''}
    </div>
    
    <div class="footer">
      <p>Automated Kalshi Trading System</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function formatPnL(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${pnl.toFixed(2)}`;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

