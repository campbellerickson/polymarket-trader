import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';

/**
 * Test endpoint to check what's actually in the contracts table
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Count total contracts
    const { count: totalCount, error: countError } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true });
    
    // Count unresolved contracts
    const { count: unresolvedCount, error: unresolvedError } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);
    
    // Count resolved contracts
    const { count: resolvedCount, error: resolvedError } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', true);
    
    // Get a few sample contracts
    const { data: samples, error: samplesError } = await supabase
      .from('contracts')
      .select('market_id, question, resolved, discovered_at, current_odds')
      .order('discovered_at', { ascending: false })
      .limit(5);
    
    // Get contracts from last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { count: recentCount, error: recentError } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .gte('discovered_at', twoHoursAgo.toISOString());
    
    return res.status(200).json({
      totalContracts: totalCount || 0,
      unresolvedContracts: unresolvedCount || 0,
      resolvedContracts: resolvedCount || 0,
      recentContracts: recentCount || 0,
      recentCutoff: twoHoursAgo.toISOString(),
      sampleContracts: samples || [],
      errors: {
        countError: countError?.message,
        unresolvedError: unresolvedError?.message,
        resolvedError: resolvedError?.message,
        samplesError: samplesError?.message,
        recentError: recentError?.message,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
}

