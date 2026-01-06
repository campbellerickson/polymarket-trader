import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchAllMarkets, getOrderbookWithLiquidity, getAccountBalance } from '../../../lib/kalshi/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Require the cron secret so this endpoint isn't publicly callable
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Enable debug logging for this test
  process.env.DEBUG_AUTH = 'true';

  const testResults: any = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {
      passed: 0,
      failed: 0,
      errors: [] as string[],
    },
  };

  try {
    // Test 1: Account Balance
    console.log('🧪 Test 1: Fetching account balance...');
    try {
      const balance = await getAccountBalance();
      testResults.tests.accountBalance = {
        passed: true,
        balance: balance,
        message: `Account balance: $${balance.toFixed(2)}`,
      };
      testResults.summary.passed++;
    } catch (error: any) {
      testResults.tests.accountBalance = {
        passed: false,
        error: error.message,
      };
      testResults.summary.failed++;
      testResults.summary.errors.push(`Account Balance: ${error.message}`);
    }

    // Test 2: Fetch All Markets (with pagination)
    console.log('🧪 Test 2: Fetching all markets with pagination...');
    try {
      const markets = await fetchAllMarkets();
      testResults.tests.fetchMarkets = {
        passed: true,
        totalMarkets: markets.length,
        sampleMarket: markets.length > 0 ? {
          market_id: markets[0].market_id,
          question: markets[0].question.substring(0, 100),
          yes_odds: markets[0].yes_odds,
          end_date: markets[0].end_date,
        } : null,
        message: `Fetched ${markets.length} markets`,
      };
      testResults.summary.passed++;

      // Test 3: Filter for high-conviction markets
      if (markets.length > 0) {
        console.log('🧪 Test 3: Filtering for high-conviction markets (>85% or <15%)...');
        const highConviction = markets.filter(m => {
          const yesPriceCents = m.yes_odds * 100;
          return yesPriceCents >= 85 || yesPriceCents <= 15;
        });

        testResults.tests.filterHighConviction = {
          passed: true,
          totalMarkets: markets.length,
          highConvictionCount: highConviction.length,
          highConvictionSample: highConviction.slice(0, 3).map(m => ({
            market_id: m.market_id,
            question: m.question.substring(0, 80),
            yes_odds: m.yes_odds,
            yes_price_cents: Math.round(m.yes_odds * 100),
          })),
          message: `Found ${highConviction.length} high-conviction markets out of ${markets.length} total`,
        };
        testResults.summary.passed++;

        // Test 4: Orderbook Enrichment (test on first high-conviction market)
        if (highConviction.length > 0) {
          console.log('🧪 Test 4: Testing orderbook enrichment...');
          const testMarket = highConviction[0];
          try {
            const { orderbook, liquidity, side } = await getOrderbookWithLiquidity(testMarket.market_id);
            testResults.tests.orderbookEnrichment = {
              passed: true,
              market_id: testMarket.market_id,
              liquidity: liquidity,
              side: side,
              orderbook: {
                bestYesBid: orderbook.bestYesBid,
                bestYesAsk: orderbook.bestYesAsk,
                bestNoBid: orderbook.bestNoBid,
                bestNoAsk: orderbook.bestNoAsk,
              },
              message: `Orderbook fetched successfully. Liquidity: ${liquidity} contracts (${side} side)`,
            };
            testResults.summary.passed++;
          } catch (error: any) {
            testResults.tests.orderbookEnrichment = {
              passed: false,
              market_id: testMarket.market_id,
              error: error.message,
            };
            testResults.summary.failed++;
            testResults.summary.errors.push(`Orderbook Enrichment: ${error.message}`);
          }
        } else {
          testResults.tests.orderbookEnrichment = {
            passed: false,
            message: 'Skipped: No high-conviction markets to test orderbook',
          };
        }
      }
    } catch (error: any) {
      testResults.tests.fetchMarkets = {
        passed: false,
        error: error.message,
      };
      testResults.summary.failed++;
      testResults.summary.errors.push(`Fetch Markets: ${error.message}`);
    }

    // Overall status
    testResults.status = testResults.summary.failed === 0 ? 'PASSED' : 'PARTIAL';
    if (testResults.summary.passed === 0) {
      testResults.status = 'FAILED';
    }

    return res.status(200).json(testResults);
  } catch (error: any) {
    console.error('Kalshi API test error:', error);
    return res.status(500).json({
      status: 'FAILED',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

