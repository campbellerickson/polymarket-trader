import type { NextApiRequest, NextApiResponse } from 'next';
import { getPortfolioApi } from '../../../lib/kalshi/client';

/**
 * Debug endpoint to see what settlements are available from Kalshi
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get settlements from Kalshi
    const portfolioApi = getPortfolioApi();
    const { data: settlementsResponse } = await portfolioApi.getSettlements(1000);
    const settlements = (settlementsResponse as any).settlements || [];

    console.log(`Fetched ${settlements.length} settlements from Kalshi`);

    // Filter settlements that have actual results
    const settledMarkets = settlements.filter((s: any) =>
      s.result && (s.result.toLowerCase() === 'yes' || s.result.toLowerCase() === 'no')
    );

    // Get a sample of settled markets
    const samples = settledMarkets.slice(0, 10).map((s: any) => ({
      ticker: s.ticker,
      result: s.result,
      revenue: s.revenue,
      settled_at: s.settled_at,
    }));

    return res.status(200).json({
      success: true,
      total_settlements: settlements.length,
      settled_markets: settledMarkets.length,
      pending_markets: settlements.length - settledMarkets.length,
      samples: samples,
      note: 'These are markets that have been settled with yes/no results'
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
