import { env } from '../../config/env';
import { Market, Orderbook } from '../../types';
import { Configuration, PortfolioApi, MarketApi, OrdersApi } from 'kalshi-typescript';

export const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Normalize PEM key from environment variable
 * Handles escaped newlines and surrounding quotes
 */
function normalizePemKey(raw: string): string {
  let key = (raw ?? '').trim();

  // Strip surrounding quotes if present (common when copy/pasted from env exports)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Convert escaped newlines to real newlines
  key = key.replace(/\\n/g, '\n');

  // Normalize CRLF
  key = key.replace(/\r\n/g, '\n');

  return key;
}

/**
 * Initialize Kalshi SDK configuration
 * The SDK handles RSA-PSS signing automatically
 */
function getKalshiConfig(): Configuration {
  const privateKeyPem = normalizePemKey(env.KALSHI_PRIVATE_KEY);
  
  if (
    !privateKeyPem.includes('BEGIN RSA PRIVATE KEY') &&
    !privateKeyPem.includes('BEGIN PRIVATE KEY') &&
    !privateKeyPem.includes('BEGIN ENCRYPTED PRIVATE KEY')
  ) {
    throw new Error('Invalid private key format: missing PEM BEGIN marker');
  }

  return new Configuration({
    apiKey: env.KALSHI_API_ID,
    privateKeyPem: privateKeyPem,
    basePath: KALSHI_API_BASE,
  });
}

// Singleton instances (reused across requests)
let portfolioApiInstance: PortfolioApi | null = null;
let marketApiInstance: MarketApi | null = null;
let ordersApiInstance: OrdersApi | null = null;

function getPortfolioApi(): PortfolioApi {
  if (!portfolioApiInstance) {
    portfolioApiInstance = new PortfolioApi(getKalshiConfig());
  }
  return portfolioApiInstance;
}

export function getMarketApi(): MarketApi {
  if (!marketApiInstance) {
    marketApiInstance = new MarketApi(getKalshiConfig());
  }
  return marketApiInstance;
}

function getOrdersApi(): OrdersApi {
  if (!ordersApiInstance) {
    ordersApiInstance = new OrdersApi(getKalshiConfig());
  }
  return ordersApiInstance;
}

/**
 * Extract yes bid price in cents from market data
 * Handles field migration: checks yes_bid (integer cents) first, then yes_bid_dollars (float)
 * Works both before and after January 15, 2026
 */
export function extractYesBidCents(market: any): number | null {
  // Primary: yes_bid as integer cents (pre-Jan 15, 2026 and post-migration)
  if (typeof market.yes_bid === 'number') {
    return Math.round(market.yes_bid);
  }
  
  // Fallback: yes_bid_dollars as float (post-Jan 15, 2026 migration)
  if (typeof market.yes_bid_dollars === 'number') {
    return Math.round(market.yes_bid_dollars * 100);
  }
  
  // Legacy fallbacks (try camelCase variants)
  if (typeof market.yesBid === 'number') {
    return Math.round(market.yesBid);
  }
  
  if (typeof market.yesBidDollars === 'number') {
    return Math.round(market.yesBidDollars * 100);
  }
  
  // If price is already normalized (0-1 range), convert to cents
  if (typeof market.yes_odds === 'number' && market.yes_odds > 0 && market.yes_odds <= 1) {
    return Math.round(market.yes_odds * 100);
  }
  
  return null;
}

/**
 * Sleep/delay helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all active markets with cursor-based pagination and rate limiting
 * Uses Filter-then-Fetch approach: gets all markets first, then enriches with orderbook
 * Rate limited: 2 requests per second max (500ms delay between requests)
 */
export async function fetchAllMarkets(options?: {
  rateLimitMs?: number; // Delay between requests (default 500ms = 2 req/sec)
  maxPages?: number;
}): Promise<Market[]> {
  const allMarkets: any[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  const rateLimitMs = options?.rateLimitMs ?? 500; // Default 500ms = 2 req/sec (safe)
  const maxPages = options?.maxPages ?? 100; // Safety limit

  console.log(`🔍 Fetching all active markets from Kalshi (with pagination, ${rateLimitMs}ms rate limit)...`);

  const marketApi = getMarketApi();

  do {
    pageCount++;
    if (pageCount > maxPages) {
      console.warn(`⚠️ Reached max pages limit (${maxPages}). Stopping pagination.`);
      break;
    }

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
      const markets = response.data.markets || [];
      allMarkets.push(...markets);
      
      // Get next cursor for pagination
      cursor = response.data.cursor || null;
      
      console.log(`   Page ${pageCount}: Fetched ${markets.length} markets (total: ${allMarkets.length})`);
      
      // If no cursor or empty markets, we're done
      if (!cursor || markets.length === 0) {
        break;
      }
      
      // Rate limit: wait before next request (except for last page)
      if (cursor && markets.length > 0) {
        await sleep(rateLimitMs);
      }
    } catch (error: any) {
      // Handle rate limiting gracefully
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000; // Default 5 seconds
        console.warn(`⚠️ Rate limited (429). Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        continue; // Retry this page
      }
      
      // If rate limited (in error message), wait and retry
      if (error.message?.includes('429') || error.message?.includes('rate')) {
        console.warn(`⚠️ Rate limit error. Waiting ${rateLimitMs * 2}ms before retry...`);
        await sleep(rateLimitMs * 2);
        continue; // Retry this page
      }
      
      console.error(`Error fetching markets page ${pageCount}:`, error.message);
      throw error;
    }
  } while (cursor);

  console.log(`✅ Fetched ${allMarkets.length} total markets across ${pageCount} pages`);

  // Convert raw market data to Market format
  return allMarkets.map((market: any) => {
    const yesBidCents = extractYesBidCents(market);
    const yesOdds = yesBidCents !== null ? yesBidCents / 100 : 0;
    const noOdds = yesBidCents !== null ? (100 - yesBidCents) / 100 : 0;

    // Parse expiration time (ISO 8601)
    let endDate: Date;
    try {
      endDate = new Date(market.expiration_time || market.expirationTime || market.end_date);
      if (isNaN(endDate.getTime())) {
        console.warn(`Invalid expiration date for market ${market.ticker}: ${market.expiration_time}`);
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days from now
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
      liquidity: 0, // Will be enriched from orderbook
      volume_24h: parseFloat(market.volume || market.volume_24h || 0),
      resolved: market.status === 'closed' || market.status === 'resolved' || false,
      category: market.category || undefined,
      outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
      final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
      resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
    };
  });
}

/**
 * Get orderbook for a specific market with liquidity information
 * Returns liquidity as number of contracts available at best price
 */
export async function getOrderbookWithLiquidity(ticker: string): Promise<{
  orderbook: Orderbook;
  liquidity: number; // Contracts available at best price
  side: 'YES' | 'NO'; // Which side we'd be buying
}> {
  const marketApi = getMarketApi();
  
  try {
    // Use SDK's getMarketOrderbook method
    const response = await marketApi.getMarketOrderbook(ticker);
    const orderbookData = response.data.orderbook || response.data;
    
    // SDK Orderbook structure: { 'true': [[price, size], ...], 'false': [[price, size], ...], yes_dollars: [...], no_dollars: [...] }
    // 'true' array = YES bids (sorted by price descending, best first)
    // 'false' array = NO bids (sorted by price descending, best first)
    // Each entry is [price_in_cents, size_in_contracts] as numbers
    const yesBids = orderbookData['true'] || [];
    const noBids = orderbookData['false'] || [];
    
    // Extract best prices and sizes (first entry in each array is the best bid)
    const bestYesBid = yesBids.length > 0 && Array.isArray(yesBids[0]) && yesBids[0].length >= 2 ? {
      price: (yesBids[0][0] as number) / 100, // price in cents -> dollars
      size: yesBids[0][1] as number, // size in contracts
    } : { price: 0, size: 0 };

    const bestNoBid = noBids.length > 0 && Array.isArray(noBids[0]) && noBids[0].length >= 2 ? {
      price: (noBids[0][0] as number) / 100, // price in cents -> dollars
      size: noBids[0][1] as number, // size in contracts
    } : { price: 0, size: 0 };

    // For asks, we'd need to look at asks (if available), but SDK orderbook shows bids
    // For now, use bids as proxy (best bid = what we can buy at)
    const bestYesAsk = bestYesBid; // Approximate - SDK may not provide asks in this structure
    const bestNoAsk = bestNoBid; // Approximate

    // Determine which side we'd be buying based on price
    // If yes price > 85 cents, we buy YES (use yes bids for liquidity)
    // If yes price < 15 cents, we effectively buy NO (use no bids for liquidity)
    const yesPriceCents = bestYesBid.price * 100;
    let liquidity: number;
    let side: 'YES' | 'NO';

    if (yesPriceCents >= 85) {
      // High probability YES - we'd buy YES contracts
      liquidity = bestYesBid.size;
      side = 'YES';
    } else if (yesPriceCents <= 15) {
      // Low probability YES (high NO) - we'd buy NO contracts
      liquidity = bestNoBid.size;
      side = 'NO';
    } else {
      // Middle range (16-84%) - not in our filter range, but return yes liquidity as default
      liquidity = bestYesBid.size;
      side = 'YES';
    }

    const orderbookResult: Orderbook = {
      market_id: ticker,
      bestYesBid: bestYesBid.price,
      bestYesAsk: bestYesAsk.price,
      bestNoBid: bestNoBid.price,
      bestNoAsk: bestNoAsk.price,
    };

    return {
      orderbook: orderbookResult,
      liquidity,
      side,
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    throw new Error(`Failed to fetch orderbook: ${statusCode} - ${errorMessage}`);
  }
}

/**
 * Calculate days to resolution from expiration time
 */
export function calculateDaysToResolution(expirationTime: Date): number {
  const now = new Date();
  const diffMs = expirationTime.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, diffDays); // Don't return negative days
}

/**
 * Fetch markets (backward compatibility - uses new fetchAllMarkets)
 */
export async function fetchMarkets(): Promise<Market[]> {
  return fetchAllMarkets();
}

/**
 * Get a specific market by ticker
 */
export async function getMarket(ticker: string): Promise<Market> {
  const marketApi = getMarketApi();
  
  try {
    const response = await marketApi.getMarket(ticker);
    const market: any = response.data.market || response.data;
    
    const yesBidCents = extractYesBidCents(market);
    const yesOdds = yesBidCents !== null ? yesBidCents / 100 : 0;
    const noOdds = yesBidCents !== null ? (100 - yesBidCents) / 100 : 0;
    
    return {
      market_id: market.ticker || market.market_id || market.id,
      question: market.title || market.question || market.subtitle,
      end_date: new Date(market.expiration_time || market.expirationTime || market.end_date),
      yes_odds: yesOdds,
      no_odds: noOdds,
      liquidity: parseFloat(market.liquidity || market.open_interest || 0),
      volume_24h: parseFloat(market.volume || market.volume_24h || 0),
      resolved: market.status === 'closed' || market.status === 'resolved' || false,
      category: market.category || undefined,
      outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
      final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
      resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    throw new Error(`Failed to fetch market: ${statusCode} - ${errorMessage}`);
  }
}

/**
 * Get orderbook for a specific market (backward compatibility)
 */
export async function getOrderbook(ticker: string): Promise<Orderbook> {
  const { orderbook } = await getOrderbookWithLiquidity(ticker);
  return orderbook;
}

/**
 * Get account balance from Kalshi
 * Uses the official SDK which handles authentication automatically
 */
export async function getAccountBalance(): Promise<number> {
  const portfolioApi = getPortfolioApi();
  
  try {
    const response = await portfolioApi.getBalance();
    // Kalshi returns balance in cents, convert to dollars
    // SDK type: GetBalanceResponse has 'balance' property
    const balance = response.data.balance || 0;
    return balance / 100;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    throw new Error(`Failed to fetch balance: ${statusCode} ${errorMessage}`);
  }
}

/**
 * Place an order on Kalshi
 * Uses the official SDK which handles authentication automatically
 */
export async function placeOrder(order: {
  market: string;
  side: 'YES' | 'NO' | 'SELL_YES' | 'SELL_NO';
  amount: number;
  price: number;
}): Promise<any> {
  if (process.env.DRY_RUN === 'true') {
    console.log('🧪 DRY RUN: Would place order:', order);
    return { order_id: 'dry-run-order', status: 'resting' };
  }

  const ordersApi = getOrdersApi();
  
  // Convert side to Kalshi format
  const side = order.side === 'YES' || order.side === 'SELL_YES' ? 'yes' : 'no';
  const action = order.side.startsWith('SELL') ? 'sell' : 'buy';
  
  // Kalshi uses price in cents (0-100), count in contracts
  // Price should be integer between 1-99 (cents)
  const orderPrice = Math.max(1, Math.min(99, Math.floor(order.price * 100)));
  
  try {
    // OrdersApi.createOrder takes a CreateOrderRequest object
    // Use yes_price or no_price depending on side
    const orderRequest: any = {
      ticker: order.market,
      side: side as 'yes' | 'no',
      action: action as 'buy' | 'sell',
      count: Math.floor(order.amount), // Number of contracts
      type: 'limit', // 'limit' or 'market'
    };
    
    // Set price based on side (yes_price for yes side, no_price for no side)
    if (side === 'yes') {
      orderRequest.yes_price = orderPrice; // Price in cents (1-99)
    } else {
      orderRequest.no_price = orderPrice; // Price in cents (1-99)
    }
    
    const response = await ordersApi.createOrder(orderRequest);
    
    return (response.data as any).order || response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    throw new Error(`Failed to place order: ${statusCode} ${errorMessage}`);
  }
}
