import { sendSMS } from '../notifications/sms';
import { sendEmail } from '../notifications/email';

export async function sendErrorAlert(error: Error): Promise<void> {
  const message = `🚨 KALSHI TRADER ERROR

${error.message}

Stack:
${error.stack?.substring(0, 500)}

Time: ${new Date().toISOString()}`;

  // Log error (notifications removed)
  console.error('🚨 ERROR ALERT:', message);
  await sendEmail('admin@kalshi-trader.com', '🚨 Kalshi Trader Error', `<pre>${message}</pre>`);
}

export async function sendDailySummary(summary: {
  contracts_analyzed: number;
  trades_executed: number;
  total_allocated: number;
  current_bankroll: number;
}): Promise<void> {
  const message = `📊 Daily Trading Summary

Contracts Analyzed: ${summary.contracts_analyzed}
Trades Executed: ${summary.trades_executed}
Total Allocated: $${summary.total_allocated.toFixed(2)}
Current Bankroll: $${summary.current_bankroll.toFixed(2)}`;

  // Log summary (notifications removed)
  console.log('📊 DAILY SUMMARY:', message);
  await sendSMS('admin', message);
}

export async function sendBuyAlert(trade: {
  question: string;
  side: string;
  allocation: number;
  odds: number;
  reasoning: string;
}): Promise<void> {
  const message = `🟢 BUY ALERT

${trade.question.substring(0, 100)}...

Side: ${trade.side}
Odds: ${(trade.odds * 100).toFixed(1)}%
Amount: $${trade.allocation.toFixed(2)}

Reason: ${trade.reasoning.substring(0, 150)}...`;

  console.log('🟢 BUY ALERT:', message);
  await sendSMS('admin', message);
}

export async function sendResolutionAlert(resolution: {
  question: string;
  outcome: 'won' | 'lost' | 'stopped';
  entryOdds: number;
  exitOdds: number;
  pnl: number;
  holdingPeriod: number; // hours
}): Promise<void> {
  const emoji = resolution.outcome === 'won' ? '🎉' : resolution.outcome === 'lost' ? '❌' : '⚠️';
  const outcomeText = resolution.outcome.toUpperCase();

  const message = `${emoji} RESOLUTION: ${outcomeText}

${resolution.question.substring(0, 100)}...

Entry: ${(resolution.entryOdds * 100).toFixed(1)}%
Exit: ${(resolution.exitOdds * 100).toFixed(1)}%
P&L: ${resolution.pnl >= 0 ? '+' : ''}$${resolution.pnl.toFixed(2)}
Holding: ${resolution.holdingPeriod.toFixed(1)}h`;

  console.log(`${emoji} RESOLUTION ALERT:`, message);
  await sendSMS('admin', message);
}

