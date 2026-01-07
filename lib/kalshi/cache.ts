import { supabase } from '../database/client';
import { Market } from '../../types';
import { extractYesBidCents, getMarketApi, getOrderbookWithLiquidity } from './client';
import { MarketApi } from 'kalshi-typescript';

/**
 * Check if a market has a simple yes/no question (not multiple questions)
 * Filters out markets with multiple yes clauses or multiple no clauses
 */
function isSimpleYesNoMarket(question: string): boolean {
  if (!question || question.length === 0) {
    return false;
  }

  const questionLower = question.toLowerCase().trim();
  
  // Count occurrences of "yes" clauses (pattern: "yes" followed by text, possibly comma-separated)
  // Match patterns like "yes X", "yes X:", "yes X,", "yes X: Y"
  const yesMatches = questionLower.match(/\byes\s+[^,]+/gi) || [];
  
  // Count occurrences of "no" clauses (pattern: "no" followed by text, possibly comma-separated)
  // Match patterns like "no X", "no X:", "no X,", "no X: Y"
  const noMatches = questionLower.match(/\bno\s+[^,]+/gi) || [];
  
  // Filter out if there's more than one yes clause OR more than one no clause
  if (yesMatches.length > 1 || noMatches.length > 1) {
    return false;
  }
  
  // If it passes, it's a simple yes/no market (0-1 yes clauses, 0-1 no clauses)
  return true;
}

/**
 * Cache market data in database to avoid excessive API calls
 * Markets are refreshed gradually via cron job
 */

const MARKET_CACHE_TTL_HOURS = 2; // Consider cache stale after 2 hours

/**
 * Get cached markets from database (fresher than TTL)
 */
export async function getCachedMarkets(): Promise<Market[]> {
  const cutoffTime = new Date(Date.now() - MARKET_CACHE_TTL_HOURS * 60 * 60 * 1000);
  
  // First try: Get markets within TTL that are not resolved
  let { data, error } = await supabase
    .from('contracts')
    .select('*')
    .gte('discovered_at', cutoffTime.toISOString())
    .eq('resolved', false)
    .order('discovered_at', { ascending: false })
    .limit(500); // Limit to avoid huge queries

  if (error) {
    console.error('Error fetching cached markets:', error);
    return [];
  }

  // If no results with resolved=false filter, try without the resolved filter
  // (markets might be cached but not yet marked as resolved)
  if (!data || data.length === 0) {
    console.log('⚠️ No unresolved markets found in cache. Trying with resolved filter removed...');
    
    const { data: allData, error: allError } = await supabase
      .from('contracts')
      .select('*')
      .gte('discovered_at', cutoffTime.toISOString())
      .order('discovered_at', { ascending: false })
      .limit(500);
    
    if (allError) {
      console.error('Error fetching all cached markets:', allError);
      return [];
    }
    
    if (allData && allData.length > 0) {
      console.log(`   Found ${allData.length} cached markets (some may be resolved)`);
      // Filter out resolved markets manually
      data = allData.filter(row => !row.resolved || row.resolved === false);
      console.log(`   After filtering resolved: ${data.length} markets`);
    }
  }

  if (!data || data.length === 0) {
    console.log(`⚠️ No cached markets found (checked within last ${MARKET_CACHE_TTL_HOURS} hours)`);
    return [];
  }
  
  console.log(`✅ Found ${data.length} cached markets`);

  // Convert DB format to Market format
  return data.map((row: any) => {
    // Handle both old format (current_odds) and new format (yes_odds, no_odds)
    let yesOdds = 0;
    let noOdds = 0;
    
    // Try to get yes_odds
    if (row.yes_odds !== undefined && row.yes_odds !== null) {
      yesOdds = parseFloat(String(row.yes_odds));
    } else if (row.current_odds !== undefined && row.current_odds !== null) {
      yesOdds = parseFloat(String(row.current_odds));
    }
    
    // Try to get no_odds
    if (row.no_odds !== undefined && row.no_odds !== null) {
      noOdds = parseFloat(String(row.no_odds));
    } else {
      // Calculate from yes_odds if available
      noOdds = yesOdds > 0 ? (1 - yesOdds) : 0;
    }
    
    // Safely parse end_date
    let endDate: Date;
    try {
      if (row.end_date) {
        endDate = new Date(row.end_date);
        if (isNaN(endDate.getTime())) {
          endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days from now
        }
      } else {
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
    } catch (e) {
      endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    
    return {
      market_id: row.market_id || '',
      question: row.question || '',
      end_date: endDate,
      yes_odds: yesOdds,
      no_odds: noOdds,
    liquidity: row.liquidity !== undefined && row.liquidity !== null ? parseFloat(String(row.liquidity)) : 0,
    volume_24h: row.volume_24h !== undefined && row.volume_24h !== null ? parseFloat(String(row.volume_24h)) : 0,
    resolved: row.resolved === true || row.resolved === 'true' || false,
    category: row.category || undefined,
    outcome: row.outcome || undefined,
    final_odds: row.final_odds !== undefined && row.final_odds !== null ? parseFloat(String(row.final_odds)) : undefined,
    resolved_at: row.resolved_at ? (() => {
      try {
        const date = new Date(row.resolved_at);
        return isNaN(date.getTime()) ? undefined : date;
      } catch (e) {
        return undefined;
      }
    })() : undefined,
    };
  });
}

/**
 * Store/update markets in cache
 */
export async function cacheMarkets(markets: Market[]): Promise<void> {
  if (markets.length === 0) return;

  console.log(`💾 Caching ${markets.length} markets to database...`);

  // Upsert markets (update if exists, insert if not)
  // Only include columns that exist in the database to avoid schema errors
  const rows = markets.map(market => {
    const row: any = {
      market_id: market.market_id,
      question: market.question,
      end_date: market.end_date.toISOString(),
      yes_odds: market.yes_odds || 0,
      no_odds: market.no_odds || (1 - (market.yes_odds || 0)), // Calculate no_odds if not provided
      category: market.category || null,
      liquidity: market.liquidity || 0,
      volume_24h: market.volume_24h || 0,
      discovered_at: new Date().toISOString(), // Update timestamp
    };
    
    // Only add optional columns if they exist
    // These will be added via migration, but we handle gracefully if not present yet
    if (market.resolved !== undefined) {
      row.resolved = market.resolved || false;
    }
    if (market.outcome) {
      row.outcome = market.outcome;
    }
    if (market.final_odds !== undefined) {
      row.final_odds = market.final_odds || null;
    }
    if (market.resolved_at) {
      row.resolved_at = market.resolved_at.toISOString();
    }
    
    return row;
  });

  // Batch upsert in chunks of 100 (Supabase limit)
  const chunkSize = 100;
  let totalCached = 0;
  let errors = 0;
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    
    try {
      const { data, error } = await supabase
        .from('contracts')
        .upsert(chunk, {
          onConflict: 'market_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`❌ Error caching markets chunk ${i / chunkSize + 1}:`, error);
        console.error(`   Error details:`, JSON.stringify(error, null, 2));
        errors++;
      } else {
        totalCached += chunk.length;
        console.log(`   ✅ Cached chunk ${i / chunkSize + 1}/${Math.ceil(rows.length / chunkSize)} (${chunk.length} markets)`);
      }
    } catch (err: any) {
      console.error(`❌ Exception caching markets chunk ${i / chunkSize + 1}:`, err.message);
      console.error(`   Stack:`, err.stack);
      errors++;
    }
  }

  if (errors > 0) {
    console.warn(`⚠️ Cached ${totalCached}/${markets.length} markets with ${errors} errors`);
  } else {
    console.log(`✅ Cached ${totalCached}/${markets.length} markets successfully`);
  }
}

/**
 * Refresh a single page of markets and cache it
 * Designed to be called periodically to gradually refresh market data
 */
export async function refreshMarketPage(cursor?: string): Promise<{
  markets: Market[];
  nextCursor: string | null;
  isComplete: boolean;
}> {
  console.log('🔄 Refreshing market page...', cursor ? `(cursor: ${cursor.substring(0, 20)}...)` : '(first page)');

  const marketApi = getMarketApi();

  try {
    // Use SDK's getMarkets method (positional parameters)
    const response = await marketApi.getMarkets(
      100, // limit
      cursor || undefined, // cursor
      undefined, // eventTicker
      undefined, // seriesTicker
      undefined, // minCreatedTs
      undefined, // maxCreatedTs
      undefined, // maxCloseTs
      undefined, // minCloseTs
      undefined, // minSettledTs
      undefined, // maxSettledTs
      'open', // status
      undefined, // tickers
      undefined, // mveFilter
    );

    // SDK returns data in response.data
    const rawMarkets = response.data.markets || [];
    const nextCursor = response.data.cursor || null;

    // Convert to Market format using two-step approach:
    // Step 1: Get all open market tickers (already filtered by status='open' in API call)
    // Step 2: Fetch orderbook for each to get real bid/ask pricing
    const rawCount = rawMarkets.length;
    console.log(`   📊 Processing ${rawCount} open markets from API...`);
    
    // Filter to only open markets (double-check, though API already filters)
    const openMarkets = rawMarkets.filter((market: any) => {
      const isOpen = market.status === 'open' || market.status === 'Open' || market.status === 'OPEN';
      return isOpen;
    });
    
    console.log(`   📊 Found ${openMarkets.length} open markets to process...`);
    
    // Process markets and enrich with orderbook data
    const marketObjects: Market[] = [];
    
    for (let index = 0; index < openMarkets.length; index++) {
      const market = openMarkets[index];
      
      try {
        // STEP 2: Fetch orderbook to get real bid/ask pricing
        // Open markets should have orderbook data
        let yesOdds = 0;
        let noOdds = 0;
        let liquidity = 0;
        
        try {
          const { orderbook: orderbookData, liquidity: orderbookLiquidity } = await getOrderbookWithLiquidity(market.ticker || market.market_id || market.id);
          
          // Get best bids from orderbook (in cents: 0-100)
          const yesBidCents = orderbookData.bestYesBid * 100;
          const noBidCents = orderbookData.bestNoBid * 100;
          
          // Use whichever side has pricing
          if (yesBidCents > 0) {
            yesOdds = yesBidCents / 100;
            noOdds = 1 - yesOdds;
          } else if (noBidCents > 0) {
            noOdds = noBidCents / 100;
            yesOdds = 1 - noOdds;
          } else {
            // No bids on either side - skip this market
            if (index < 5) {
              console.log(`   ⚠️ Market ${index + 1} has no orderbook bids: ${market.ticker}`);
            }
            continue; // Skip to next market
          }
          
          liquidity = orderbookLiquidity;
          
          if (index < 3) {
            console.log(`   ✅ Market ${index + 1}: ${market.ticker} - yes=${(yesOdds*100).toFixed(1)}%, no=${(noOdds*100).toFixed(1)}%, liquidity=${liquidity}`);
          }
          
          // Rate limit: wait 200ms between orderbook calls
          if (index < openMarkets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error: any) {
          // If orderbook fetch fails, skip this market
          if (index < 5) {
            console.log(`   ⚠️ Failed to fetch orderbook for ${market.ticker}: ${error.message}`);
          }
          continue;
        }

        // 3. PARSE DATES & METADATA
        let endDate: Date;
        try {
          // SDK uses various fields for expiration
          const expirationTime = market.expected_expiration_time || market.expiration_time || market.close_time || market.end_date;
          endDate = new Date(expirationTime);
          // Default to 7 days if date is invalid
          if (isNaN(endDate.getTime())) {
            endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          }
        } catch (e) {
          endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }

        const resolved = market.status === 'closed' || market.status === 'settled';
        const outcome = market.result === 'yes' ? 'YES' : market.result === 'no' ? 'NO' : undefined;
        
        // Handle various title fields
        const question = market.title || market.question || market.subtitle || 'N/A';
        
        // Filter out complex markets
        if (!isSimpleYesNoMarket(question)) {
          if (index < 5) {
            console.log(`   🔀 Complex market ${index + 1} filtered: ${market.ticker.substring(0, 50)}...`);
          }
          return null;
        }

        // Add market to our list
        marketObjects.push({
          market_id: market.ticker || market.market_id || market.id,
          question: question,
          end_date: endDate,
          yes_odds: yesOdds,
          no_odds: noOdds,
          liquidity: liquidity,
          volume_24h: parseFloat(market.volume_24h || market.volume || 0),
          resolved: resolved,
          category: market.category || market.event_ticker || undefined,
          outcome: outcome,
          final_odds: market.last_price ? market.last_price / 100 : undefined,
          resolved_at: market.close_time ? new Date(market.close_time) : undefined,
        });
        
      } catch (error: any) {
        // Log error but continue processing other markets
        if (index < 5) {
          console.log(`   ❌ Error processing market ${index + 1}: ${error.message}`);
        }
        continue;
      }
    }
    
    const openCount = rawMarkets.filter((m: any) => m.status === 'open' || m.status === 'Open' || m.status === 'OPEN').length;
    console.log(`   📊 After filtering: ${openCount} open markets, ${marketObjects.length} markets with pricing data`);

    // Cache the markets
    await cacheMarkets(marketObjects);

    console.log(`   ✅ Cached ${marketObjects.length} markets. Next cursor: ${nextCursor ? 'yes' : 'no'}`);

    return {
      markets: marketObjects,
      nextCursor,
      isComplete: !nextCursor || rawMarkets.length === 0,
    };
  } catch (error: any) {
    // Handle rate limiting gracefully
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
      throw new Error(`Rate limited. Wait ${waitTime}ms`);
    }
    
    // If error message contains rate limit info
    if (error.message?.startsWith('RATE_LIMITED:')) {
      const waitTime = parseInt(error.message.split(':')[1]);
      throw new Error(`Rate limited. Wait ${waitTime}ms`);
    }
    
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    throw new Error(`Kalshi API error: ${statusCode} - ${errorMessage}`);
  }
}
