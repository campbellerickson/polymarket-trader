import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateDailyReport } from '../../lib/notifications/report';
import { getNotificationPreferences } from '../../lib/database/queries';
import { sendDailyReportSMS } from '../../lib/notifications/sms';
import { sendDailyReportEmail } from '../../lib/notifications/email';
import { sendSMS } from '../../lib/notifications/sms';
import { supabase } from '../../lib/database/client';
import { formatReportForSMS } from '../../lib/notifications/report';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('📊 Generating daily report...');
    
    const reportData = await generateDailyReport();
    
    // Save to database
    await supabase
      .from('daily_reports')
      .insert({
        report_date: reportData.reportDate.toISOString().split('T')[0],
        trades_executed: reportData.tradesExecuted.length,
        total_invested: reportData.totalInvested,
        open_positions_value: reportData.openPositionsValue,
        cash_balance: reportData.cashBalance,
        total_liquidity: reportData.totalLiquidity,
        mtd_pnl: reportData.mtdPnL,
        ytd_pnl: reportData.ytdPnL,
        mtd_return_pct: reportData.mtdReturnPct,
        ytd_return_pct: reportData.ytdReturnPct,
        win_rate_mtd: reportData.mtdWinRate,
        win_rate_ytd: reportData.ytdWinRate,
        report_content: formatReportForSMS(reportData),
        sent_at: new Date().toISOString(),
      });
    
    // Get notification preferences
    const prefs = await getNotificationPreferences();
    
    // Send SMS if enabled
    if (prefs.phone_number && prefs.enabled) {
      await sendDailyReportSMS(prefs.phone_number, reportData);
      console.log('✅ SMS report sent');
    }
    
    // Send email if enabled
    if (prefs.email && prefs.enabled) {
      await sendDailyReportEmail(prefs.email, reportData);
      console.log('✅ Email report sent');
    }
    
    return res.status(200).json({
      success: true,
      reportDate: reportData.reportDate,
      tradesExecuted: reportData.tradesExecuted.length,
      totalLiquidity: reportData.totalLiquidity
    });
    
  } catch (error: any) {
    console.error('❌ Morning report failed:', error);
    const { logCronError } = await import('../../lib/utils/logger');
    await logCronError('morning-report', error);
    console.error('⚠️ Daily report failed:', error.message);
    await sendSMS('admin', `⚠️ Daily report failed: ${error.message}`);
    
    return res.status(500).json({ error: error.message });
  }
}

