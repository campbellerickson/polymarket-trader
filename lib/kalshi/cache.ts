import { supabase } from '../database/client';
import { Market } from '../../types';
import { extractYesBidCents, getMarketApi } from './client';
import { MarketApi } from 'kalshi-typescript';

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
  return data.map((row: any) => ({
    market_id: row.market_id,
    question: row.question,
    end_date: new Date(row.end_date),
    yes_odds: parseFloat(row.current_odds.toString()),
    no_odds: 1 - parseFloat(row.current_odds.toString()),
    liquidity: parseFloat(row.liquidity?.toString() || '0'),
    volume_24h: parseFloat(row.volume_24h?.toString() || '0'),
    resolved: row.resolved || false,
    category: row.category || undefined,
    outcome: row.outcome || undefined,
    final_odds: row.final_odds ? parseFloat(row.final_odds.toString()) : undefined,
    resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
  }));
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
      current_odds: market.yes_odds,
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

    // Convert to Market format using the same logic as fetchAllMarkets
    const marketObjects: Market[] = rawMarkets.map((market: any, index: number) => {
      // Debug: Log first market structure to understand SDK format
      if (index === 0) {
        console.log('   🔍 Sample market from SDK:', JSON.stringify({
          ticker: market.ticker,
          yes_bid: market.yes_bid,
          yes_bid_dollars: market.yes_bid_dollars,
          yes_ask: market.yes_ask,
          yes_ask_dollars: market.yes_ask_dollars,
          last_price: market.last_price,
          yes_price: market.yes_price,
          keys: Object.keys(market).filter(k => k.includes('yes') || k.includes('price') || k.includes('bid') || k.includes('ask')),
        }, null, 2));
      }
      
      const yesBidCents = extractYesBidCents(market);
      // SDK Market: yes_bid is in cents (0-100), convert to 0-1 range for yes_odds
      const yesOdds = yesBidCents !== null ? yesBidCents / 100 : 0;
      const noOdds = yesBidCents !== null ? (100 - yesBidCents) / 100 : 0;
      
      // Debug: Log if odds are 0
      if (index === 0 && yesOdds === 0) {
        console.warn('   ⚠️ First market has 0 odds - check extractYesBidCents function');
      }

      // SDK Market: uses expected_expiration_time, expiration_time, or close_time
      let endDate: Date;
      try {
        const expirationTime = market.expected_expiration_time || market.expiration_time || market.expirationTime || market.close_time || market.end_date;
        endDate = new Date(expirationTime);
        if (isNaN(endDate.getTime())) {
          endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
      } catch (e) {
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      // SDK Market: status is an enum ('unopened', 'open', 'closed', 'settled')
      // Only mark as resolved if status is 'closed' or 'settled' (not just 'open')
      const resolved = market.status === 'closed' || market.status === 'settled';
      
      // SDK Market: result is an enum ('yes', 'no', null)
      const outcome = market.result === 'yes' ? 'YES' : market.result === 'no' ? 'NO' : undefined;

      return {
        market_id: market.ticker || market.market_id || market.id,
        question: market.title || market.question || market.subtitle || market.yes_sub_title || 'N/A',
        end_date: endDate,
        yes_odds: yesOdds,
        no_odds: noOdds,
        liquidity: 0,
        volume_24h: parseFloat(market.volume_24h || market.volume || 0),
        resolved: resolved,
        category: market.category || market.event_ticker || undefined,
        outcome: outcome,
        final_odds: market.last_price ? parseFloat(market.last_price.toString()) / 100 : undefined,
        resolved_at: market.close_time ? new Date(market.close_time) : undefined,
      };
    });

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
