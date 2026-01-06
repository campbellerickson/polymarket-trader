import type { NextApiRequest, NextApiResponse } from 'next';
import { refreshMarketPage } from '../../../lib/kalshi/cache';
import { supabase } from '../../../lib/database/client';

/**
 * Gradual market refresh cron job
 * Called every 5-10 minutes to refresh one page of markets
 * Over an hour, this refreshes all ~1000+ markets gradually
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get the last cursor from a stored state (or start fresh)
    // Store progress in a simple key-value table or use Supabase storage
    let cursor: string | undefined = undefined;
    
    // Try to get last cursor from a simple state table (we'll create this if needed)
    // For now, check if we should start fresh or continue
    const { data: stateData } = await supabase
      .from('performance_metrics') // Reuse existing table temporarily
      .select('*')
      .limit(1);
    
    // For now, we'll refresh from the beginning each time
    // In production, you'd store the cursor in a dedicated state table
    
    console.log('🔄 Starting gradual market refresh...');
    
    const result = await refreshMarketPage(cursor);
    
    return res.status(200).json({
      success: true,
      marketsCached: result.markets.length,
      hasNextPage: !!result.nextCursor,
      nextCursor: result.nextCursor,
      isComplete: result.isComplete,
      message: result.isComplete 
        ? 'All markets refreshed' 
        : `Refreshed ${result.markets.length} markets. Next page available.`,
    });

  } catch (error: any) {
    console.error('❌ Market refresh cron failed:', error);
    
    // If rate limited, return success but with wait message
    if (error.message.includes('rate') || error.message.includes('429')) {
      return res.status(200).json({
        success: false,
        error: 'Rate limited',
        message: 'Will retry on next scheduled run',
        retryAfter: error.message.includes('Wait') ? error.message : undefined,
      });
    }
    
    const { logCronError } = await import('../../../lib/utils/logger');
    await logCronError('refresh-markets', error);
    
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

