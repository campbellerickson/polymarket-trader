import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/database/client';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  error?: string;
  stack?: string;
  context?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error) {
      // Table might not exist yet - return empty array
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return res.status(200).json({ logs: [] });
      }
      throw error;
    }
    
    const logs: LogEntry[] = (data || []).map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp || log.created_at,
      level: log.level || 'error',
      message: log.message,
      error: log.error,
      stack: log.stack,
      context: log.context ? (typeof log.context === 'string' ? JSON.parse(log.context) : log.context) : undefined,
    }));
    
    return res.status(200).json({ logs });
  } catch (error: any) {
    console.error('Logs API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
