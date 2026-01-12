import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';

/**
 * Reset outcomes to null for ai_decisions that were incorrectly backfilled
 * This allows the corrected backfill logic to re-process them
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Resetting outcomes...');

    // Reset all outcomes to null where we have allocated_amount > 0
    // This will allow the corrected backfill logic to re-process them
    const { data, error } = await supabase
      .from('ai_decisions')
      .update({ outcome: null })
      .gt('allocated_amount', 0)
      .not('outcome', 'is', null)
      .select('id');

    if (error) throw new Error(`Failed to reset outcomes: ${error.message}`);

    const resetCount = data?.length || 0;
    console.log(`✅ Reset ${resetCount} outcomes to null`);

    return res.status(200).json({
      success: true,
      reset: resetCount,
      message: 'Outcomes reset successfully. Ready for re-backfill.'
    });

  } catch (error: any) {
    console.error('❌ Reset failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
