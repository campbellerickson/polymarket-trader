import { supabase } from '../database/client';
import { Market } from '../../types';
import { KALSHI_API_BASE, createAuthHeaders, extractYesBidCents } from './client';

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
  
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .gte('discovered_at', cutoffTime.toISOString())
    .eq('resolved', false)
    .order('discovered_at', { ascending: false });

  if (error) {
    console.error('Error fetching cached markets:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

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
  const rows = markets.map(market => ({
    market_id: market.market_id,
    question: market.question,
    end_date: market.end_date.toISOString(),
    current_odds: market.yes_odds,
    category: market.category || null,
    liquidity: market.liquidity || 0,
    volume_24h: market.volume_24h || 0,
    resolved: market.resolved || false,
    outcome: market.outcome || null,
    final_odds: market.final_odds || null,
    resolved_at: market.resolved_at?.toISOString() || null,
    discovered_at: new Date().toISOString(), // Update timestamp
  }));

  // Batch upsert in chunks of 100 (Supabase limit)
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    
    const { error } = await supabase
      .from('contracts')
      .upsert(chunk, {
        onConflict: 'market_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`Error caching markets chunk ${i / chunkSize + 1}:`, error);
    } else {
      console.log(`   ✅ Cached chunk ${i / chunkSize + 1}/${Math.ceil(rows.length / chunkSize)} (${chunk.length} markets)`);
    }
  }

  console.log(`✅ Cached ${markets.length} markets successfully`);
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

  const path = cursor ? `/markets?status=open&cursor=${cursor}` : '/markets?status=open';

  try {
    const response = await fetch(`${KALSHI_API_BASE}${path}`, {
      method: 'GET',
      headers: createAuthHeaders('GET', path),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        throw new Error(`RATE_LIMITED:${waitTime}`);
      }
      const errorText = await response.text();
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const rawMarkets = data.markets || [];
    const nextCursor = data.cursor || null;

    // Convert to Market format using the same logic as fetchAllMarkets
    const marketObjects: Market[] = rawMarkets.map((market: any) => {
      const yesBidCents = extractYesBidCents(market);
      const yesOdds = yesBidCents !== null ? yesBidCents / 100 : 0;
      const noOdds = yesBidCents !== null ? (100 - yesBidCents) / 100 : 0;

      let endDate: Date;
      try {
        endDate = new Date(market.expiration_time || market.expirationTime || market.end_date);
        if (isNaN(endDate.getTime())) {
          endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
      } catch (e) {
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      return {
        market_id: market.ticker || market.market_id || market.id,
        question: market.title || market.question || market.subtitle || 'N/A',
        end_date: endDate,
        yes_odds: yesOdds,
        no_odds: noOdds,
        liquidity: 0,
        volume_24h: parseFloat(market.volume || market.volume_24h || 0),
        resolved: market.status === 'closed' || market.status === 'resolved' || false,
        category: market.category || undefined,
        outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
        final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
        resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
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
    if (error.message.startsWith('RATE_LIMITED:')) {
      const waitTime = parseInt(error.message.split(':')[1]);
      throw new Error(`Rate limited. Wait ${waitTime}ms`);
    }
    throw error;
  }
}
