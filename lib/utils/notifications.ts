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
  await sendEmail('admin@polymarket-trader.com', '🚨 Kalshi Trader Error', `<pre>${message}</pre>`);
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

