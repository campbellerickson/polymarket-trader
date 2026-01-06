import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkAndResolveOpenTrades } from '../../lib/kalshi/resolver';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🔍 Checking for resolved trades...');
    await checkAndResolveOpenTrades();
    
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('❌ Resolution check failed:', error);
    const { logCronError } = await import('../../lib/utils/logger');
    await logCronError('check-resolutions', error);
    return res.status(500).json({ error: error.message });
  }
}

