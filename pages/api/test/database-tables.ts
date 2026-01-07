import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/database/client';

/**
 * Comprehensive database tables health check
 * Tests all tables to ensure they exist and are accessible
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tables: {},
    summary: {
      totalTables: 0,
      accessibleTables: 0,
      errors: [] as string[],
    },
  };

  const requiredTables = [
    'contracts',
    'trades',
    'ai_decisions',
    'performance_metrics',
    'notification_preferences',
    'daily_reports',
    'stop_loss_events',
    'stop_loss_config',
    'error_logs',
    'monthly_analysis',
  ];

  for (const tableName of requiredTables) {
    results.summary.totalTables++;
    
    try {
      // Try to query the table
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        results.tables[tableName] = {
          exists: false,
          accessible: false,
          error: error.message,
          count: 0,
        };
        results.summary.errors.push(`${tableName}: ${error.message}`);
      } else {
        results.tables[tableName] = {
          exists: true,
          accessible: true,
          count: count || 0,
          error: null,
        };
        results.summary.accessibleTables++;
      }
    } catch (err: any) {
      results.tables[tableName] = {
        exists: false,
        accessible: false,
        error: err.message,
        count: 0,
      };
      results.summary.errors.push(`${tableName}: ${err.message}`);
    }
  }

  // Check contracts table columns specifically
  try {
    const { data: sampleContract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .limit(1);

    if (!contractError && sampleContract && sampleContract.length > 0) {
      const columns = Object.keys(sampleContract[0]);
      results.tables.contracts.columns = columns;
      results.tables.contracts.hasYesOdds = columns.includes('yes_odds');
      results.tables.contracts.hasNoOdds = columns.includes('no_odds');
      results.tables.contracts.hasCurrentOdds = columns.includes('current_odds');
      
      if (results.tables.contracts.hasCurrentOdds) {
        results.summary.errors.push('contracts: DEPRECATED column current_odds still exists - should be renamed to yes_odds');
      }
    }
  } catch (err: any) {
    results.tables.contracts.columnCheckError = err.message;
  }

  // Check trades table columns
  try {
    const { data: sampleTrade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .limit(1);

    if (!tradeError && sampleTrade && sampleTrade.length > 0) {
      const columns = Object.keys(sampleTrade[0]);
      results.tables.trades.columns = columns;
      results.tables.trades.hasRiskFactors = columns.includes('risk_factors');
      results.tables.trades.hasAiReasoning = columns.includes('ai_reasoning');
    }
  } catch (err: any) {
    results.tables.trades.columnCheckError = err.message;
  }

  const allTablesAccessible = results.summary.accessibleTables === results.summary.totalTables;
  const statusCode = allTablesAccessible ? 200 : 500;

  return res.status(statusCode).json(results);
}

