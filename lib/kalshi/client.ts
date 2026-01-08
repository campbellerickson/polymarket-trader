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

export function getOrdersApi(): OrdersApi {
  if (!ordersApiInstance) {
    ordersApiInstance = new OrdersApi(getKalshiConfig());
  }
  return ordersApiInstance;
}

/**
 * Extract yes bid price in cents from market data
 * Handles SDK Market type: yes_bid (integer cents) and yes_bid_dollars (string)
 * Works both before and after January 15, 2026
 */
export function extractYesBidCents(market: any): number | null {
  // SDK Market type: yes_bid is in cents (integer)
  // Primary: yes_bid as integer cents (SDK returns this)
  if (typeof market.yes_bid === 'number' && market.yes_bid > 0) {
    return Math.round(market.yes_bid);
  }
  
  // Try yes_ask as fallback if yes_bid is missing (common for open markets)
  if (typeof market.yes_ask === 'number' && market.yes_ask > 0) {
    return Math.round(market.yes_ask);
  }
  
  // Try yes_price if available
  if (typeof market.yes_price === 'number' && market.yes_price > 0) {
    // Check if it's already in cents (0-100) or dollars (0-1)
    if (market.yes_price > 1) {
      return Math.round(market.yes_price); // Already in cents
    } else {
      return Math.round(market.yes_price * 100); // Convert from dollars
    }
  }
  
  // Fallback: yes_bid_dollars as string (SDK returns this as fixed-point decimal string)
  if (typeof market.yes_bid_dollars === 'string') {
    const dollarValue = parseFloat(market.yes_bid_dollars);
    if (!isNaN(dollarValue) && dollarValue > 0) {
      return Math.round(dollarValue * 100);
    }
  }
  
  // Fallback: yes_bid_dollars as number (if SDK returns it as number)
  if (typeof market.yes_bid_dollars === 'number' && market.yes_bid_dollars > 0) {
    return Math.round(market.yes_bid_dollars * 100);
  }
  
  // Legacy fallbacks (try camelCase variants)
  if (typeof market.yesBid === 'number' && market.yesBid > 0) {
    return Math.round(market.yesBid);
  }
  
  if (typeof market.yesBidDollars === 'number' && market.yesBidDollars > 0) {
    return Math.round(market.yesBidDollars * 100);
  }
  
  // If price is already normalized (0-1 range), convert to cents
  if (typeof market.yes_odds === 'number' && market.yes_odds > 0 && market.yes_odds <= 1) {
    return Math.round(market.yes_odds * 100);
  }
  
  // Last resort: try last_price (current market price)
  if (typeof market.last_price === 'number' && market.last_price > 0) {
    return Math.round(market.last_price);
  }
  
  return null;
}

/**
 * Sleep/delay helper for rate limiting
 */
export function sleep(ms: number): Promise<void> {
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
    // SDK Market: yes_bid is in cents (0-100), convert to 0-1 range for yes_odds
    const yesOdds = yesBidCents !== null ? yesBidCents / 100 : 0;
    const noOdds = yesBidCents !== null ? (100 - yesBidCents) / 100 : 0;

    // Parse expiration time (ISO 8601)
    // SDK Market: uses expected_expiration_time, expiration_time, or close_time
    let endDate: Date;
    try {
      const expirationTime = market.expected_expiration_time || market.expiration_time || market.expirationTime || market.close_time || market.end_date;
      endDate = new Date(expirationTime);
      if (isNaN(endDate.getTime())) {
        console.warn(`Invalid expiration date for market ${market.ticker}: ${expirationTime}`);
        endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days from now
      }
    } catch (e) {
      endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // SDK Market: status is an enum ('unopened', 'open', 'closed', 'settled')
    const resolved = market.status === 'closed' || market.status === 'settled' || market.status === 'resolved' || false;
    
    // SDK Market: result is an enum ('yes', 'no', null)
    const outcome = market.result === 'yes' ? 'YES' : market.result === 'no' ? 'NO' : undefined;

    return {
      market_id: market.ticker || market.market_id || market.id,
      question: market.title || market.question || market.subtitle || market.yes_sub_title || 'N/A',
      end_date: endDate,
      yes_odds: yesOdds,
      no_odds: noOdds,
      liquidity: 0, // Will be enriched from orderbook
      volume_24h: parseFloat(market.volume_24h || market.volume || 0),
      resolved: resolved,
      category: market.category || market.event_ticker || undefined,
      outcome: outcome,
      final_odds: market.last_price !== undefined && market.last_price !== null && market.last_price !== '' ? 
        parseFloat(String(market.last_price)) / 100 : undefined,
      resolved_at: market.close_time ? new Date(market.close_time) : undefined,
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
    // Cast to any to access raw API structure (yes/no arrays)
    const orderbookData = (response.data.orderbook || response.data) as any;
    
    // Kalshi Orderbook structure: { yes: [[price, size], ...], no: [[price, size], ...] }
    // yes array = YES bids (sorted by price descending, best first)
    // no array = NO bids (sorted by price descending, best first)
    // Each entry is [price_in_cents, size_in_contracts] as numbers
    // Handle both SDK format ('true'/'false') and API format ('yes'/'no')
    const yesBids = orderbookData.yes || orderbookData['true'] || [];
    const noBids = orderbookData.no || orderbookData['false'] || [];
    
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
    
    // SDK Market: uses expected_expiration_time, expiration_time, or close_time
    const expirationTime = market.expected_expiration_time || market.expiration_time || market.expirationTime || market.close_time || market.end_date;
    const endDate = new Date(expirationTime);
    
    // SDK Market: status is an enum ('unopened', 'open', 'closed', 'settled')
    const resolved = market.status === 'closed' || market.status === 'settled' || market.status === 'resolved' || false;
    
    // SDK Market: result is an enum ('yes', 'no', null)
    const outcome = market.result === 'yes' ? 'YES' : market.result === 'no' ? 'NO' : undefined;

    return {
      market_id: market.ticker || market.market_id || market.id,
      question: market.title || market.question || market.subtitle || market.yes_sub_title || 'N/A',
      end_date: endDate,
      yes_odds: yesOdds,
      no_odds: noOdds,
      liquidity: parseFloat(market.open_interest || market.liquidity || 0),
      volume_24h: parseFloat(market.volume_24h || market.volume || 0),
      resolved: resolved,
      category: market.category || market.event_ticker || undefined,
      outcome: outcome,
      final_odds: market.last_price !== undefined && market.last_price !== null && market.last_price !== '' ? 
        parseFloat(String(market.last_price)) / 100 : undefined,
      resolved_at: market.close_time ? new Date(market.close_time) : undefined,
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
  amount: number; // Dollar amount to spend (for market orders) OR number of contracts (for limit orders)
  price?: number; // Optional: for limit orders only
  type?: 'limit' | 'market'; // Optional: default to market for immediate fills
}): Promise<any> {
  if (process.env.DRY_RUN === 'true') {
    console.log('🧪 DRY RUN: Would place order:', order);
    return { order_id: 'dry-run-order', status: 'resting' };
  }

  const ordersApi = getOrdersApi();

  // Convert side to Kalshi format
  const side = order.side === 'YES' || order.side === 'SELL_YES' ? 'yes' : 'no';
  const action = order.side.startsWith('SELL') ? 'sell' : 'buy';

  // Use market orders by default for immediate fills
  const orderType = order.type || 'market';

  // OrdersApi.createOrder takes a CreateOrderRequest object
  const orderRequest: any = {
    ticker: order.market,
    side: side as 'yes' | 'no',
    action: action as 'buy' | 'sell',
    type: orderType,
    client_order_id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };

  if (orderType === 'market') {
    // MARKET ORDERS: Use buy_max_cost to control spending
    // Set high count and let buy_max_cost limit actual spending
    orderRequest.count = 10000; // High number to allow buying up to budget
    orderRequest.buy_max_cost = Math.floor(order.amount * 100); // Dollar amount in cents
    console.log(`   📤 Market order: max ${orderRequest.count} contracts, budget $${order.amount} (${orderRequest.buy_max_cost} cents)`);
  } else {
    // LIMIT ORDERS: Use exact price and count
    if (!order.price) {
      throw new Error('Limit orders require a price parameter');
    }
    const orderPrice = Math.max(1, Math.min(99, Math.floor(order.price * 100)));
    orderRequest.count = Math.floor(order.amount); // Exact number of contracts

    // Set price based on side
    if (side === 'yes') {
      orderRequest.yes_price = orderPrice;
    } else {
      orderRequest.no_price = orderPrice;
    }
    console.log(`   📤 Limit order: ${orderRequest.count} contracts at ${orderPrice} cents`);
  }

  try {
    console.log('   📤 Sending order request:', JSON.stringify(orderRequest, null, 2));

    const response = await ordersApi.createOrder(orderRequest);

    return (response.data as any).order || response.data;
  } catch (error: any) {
    console.error('   ❌ Order request failed:', JSON.stringify(orderRequest, null, 2));
    console.error('   ❌ Error message:', error.message);

    // Safely extract error details without circular references
    const errorData = error.response?.data;
    const statusCode = error.response?.status || 500;

    if (errorData) {
      console.error('   ❌ Error data:', typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorData);
    }

    // Create clean error message
    const errorMessage = errorData?.error || errorData?.message || error.message || 'Unknown error';
    throw new Error(`Failed to place order: ${statusCode} ${errorMessage}`);
  }
}

/**
 * Get order status by order ID
 */
export async function getOrderStatus(orderId: string): Promise<any> {
  if (process.env.DRY_RUN === 'true') {
    return { order_id: orderId, status: 'filled', remaining_count: 0 };
  }

  const ordersApi = getOrdersApi();

  try {
    const response = await ordersApi.getOrder(orderId);
    return (response.data as any).order || response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status || 500;
    throw new Error(`Failed to get order status: ${statusCode} ${errorMessage}`);
  }
}

/**
 * Wait for order to be filled (with timeout)
 * Polls order status every 2 seconds for up to 60 seconds
 * Returns the filled order or throws if timeout/cancelled
 */
export async function waitForOrderFill(
  orderId: string,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<any> {
  if (process.env.DRY_RUN === 'true') {
    console.log('🧪 DRY RUN: Simulating order fill');
    return { order_id: orderId, status: 'filled', remaining_count: 0 };
  }

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const orderStatus = await getOrderStatus(orderId);

    console.log(`   Order status: ${orderStatus.status}, remaining: ${orderStatus.remaining_count || 0}`);

    // Order is fully filled
    if (orderStatus.status === 'filled' || orderStatus.remaining_count === 0) {
      console.log(`   ✅ Order filled!`);
      return orderStatus;
    }

    // Order was cancelled or rejected
    if (orderStatus.status === 'canceled' || orderStatus.status === 'cancelled') {
      throw new Error(`Order was cancelled: ${orderStatus.cancel_reason || 'Unknown reason'}`);
    }

    // Wait before next poll
    await sleep(pollIntervalMs);
  }

  // Timeout - order still resting
  throw new Error(`Order fill timeout after ${timeoutMs}ms. Order may still be resting in orderbook.`);
}
