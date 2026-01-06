import type { VercelRequest, VercelResponse } from '@vercel/node';
import { monitorStopLosses, checkCircuitBreaker } from '../../lib/trading/stop-loss';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🛡️ Running stop loss monitor...');
    
    const result = await monitorStopLosses();
    
    if (result.triggered > 0) {
      await checkCircuitBreaker(result.events);
    }
    
    return res.status(200).json({
      success: true,
      triggered: result.triggered,
      total_positions: result.candidates.length,
      below_threshold: result.candidates.filter(c => c.currentOdds < 0.80).length
    });
    
  } catch (error: any) {
    console.error('❌ Stop loss monitor failed:', error);
    const { logCronError } = await import('../../lib/utils/logger');
    await logCronError('stop-loss', error);
    const { sendSMS } = await import('../../lib/notifications/sms');
    console.error('🚨 CRITICAL: Stop loss monitor failed:', error.message);
    await sendSMS('admin', `🚨 CRITICAL: Stop loss monitor failed: ${error.message}`);
    
    return res.status(500).json({ error: error.message });
  }
}

