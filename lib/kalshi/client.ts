import { env } from '../../config/env';
import { Market, Orderbook } from '../../types';
import crypto from 'crypto';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Create signature for Kalshi API authentication
 * Based on official Kalshi API documentation: https://docs.kalshi.com/getting_started/api_keys
 * 
 * Signature is created by signing: timestamp + HTTP method + request path
 * For POST requests, the request body is also included in the signature
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

function createSignature(timestamp: string, method: string, path: string, body?: string): string {
  // Kalshi V2 requires: <timestamp_in_ms><METHOD><path_without_params>
  // Path MUST exclude query parameters for signature
  // Path should NOT include host (just the path after the base URL)
  const basePath = path.split('?')[0];
  
  // Build the message to sign: timestamp + METHOD + path (without query params) + body (if POST)
  // Format: <timestamp_in_ms><METHOD><path_without_params>
  const message = `${timestamp}${method.toUpperCase()}${basePath}${body || ''}`;

  // Debug logging (only in non-production)
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_AUTH === 'true') {
    console.log('🔐 Signature Debug:', {
      timestamp,
      timestampLength: timestamp.length,
      method: method.toUpperCase(),
      pathWithParams: path,
      pathWithoutParams: basePath,
      bodyLength: body ? body.length : 0,
      messageLength: message.length,
      messagePreview: message.substring(0, 150),
      messageFull: message, // Full message for debugging
    });
  }

  const privateKeyPem = normalizePemKey(env.KALSHI_PRIVATE_KEY);
  if (
    !privateKeyPem.includes('BEGIN RSA PRIVATE KEY') &&
    !privateKeyPem.includes('BEGIN PRIVATE KEY') &&
    !privateKeyPem.includes('BEGIN ENCRYPTED PRIVATE KEY')
  ) {
    throw new Error('Invalid private key format: missing PEM BEGIN marker');
  }

  try {
    const keyObject = crypto.createPrivateKey(privateKeyPem);

    // Kalshi uses RSA-PSS with SHA-256
    // Try RSA-PSS first, fallback to PKCS1 if needed
    const constants: any = (crypto as any).constants;
    
    // Kalshi V2 REQUIRES RSA-PSS with:
    // - Padding: PSS
    // - MGF: MGF1 with SHA-256
    // - Salt Length: Must match digest length (32 bytes for SHA-256) OR MAX_LENGTH
    // - Hash: SHA-256
    // Node.js uses RSA_PKCS1_PSS_PADDING constant (not RSA_PSS_PADDING)
    // Try DIGEST first (32 bytes = SHA-256 digest length), fallback to MAX_SIGN if needed
    let signature: Buffer;
    try {
      signature = crypto.sign('sha256', Buffer.from(message), {
        key: keyObject,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST, // 32 bytes for SHA-256
      });
    } catch (error: any) {
      // Fallback to MAX_SIGN if DIGEST fails
      console.warn('RSA-PSS with DIGEST salt length failed, trying MAX_SIGN:', error.message);
      signature = crypto.sign('sha256', Buffer.from(message), {
        key: keyObject,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
      });
    }

    const signatureBase64 = signature.toString('base64');
    
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_AUTH === 'true') {
      console.log('🔐 Signature created:', {
        signatureLength: signatureBase64.length,
        signaturePreview: signatureBase64.substring(0, 20) + '...',
      });
    }

    return signatureBase64;
  } catch (error: any) {
    console.error('❌ Signature creation error:', {
      error: error.message,
      stack: error.stack,
      keyFormat: privateKeyPem.substring(0, 50) + '...',
    });
    throw new Error(`Failed to create signature: ${error?.message || String(error)}. Check KALSHI_PRIVATE_KEY format.`);
  }
}

/**
 * Create authenticated headers for Kalshi API requests
 * Based on official Kalshi API documentation: https://docs.kalshi.com/getting_started/api_keys
 */
function createAuthHeaders(method: string, path: string, body?: string): Record<string, string> {
  // Timestamp MUST be in milliseconds (13 digits), as a string
  // Example: "1704581200000" (not "1704581200")
  const timestamp = Date.now().toString();
  
  // Verify timestamp is 13 digits (milliseconds)
  if (timestamp.length !== 13) {
    console.error('⚠️ WARNING: Timestamp is not 13 digits:', timestamp);
  }
  
  const signature = createSignature(timestamp, method, path, body);
  
  const headers = {
    'KALSHI-ACCESS-KEY': env.KALSHI_API_ID,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type': 'application/json',
  };

  // Debug logging
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_AUTH === 'true') {
    console.log('🔐 Auth Headers:', {
      apiKey: env.KALSHI_API_ID.substring(0, 10) + '...',
      timestamp,
      timestampLength: timestamp.length,
      signatureLength: signature.length,
      pathWithParams: path,
      method,
    });
  }

  return headers;
}

/**
 * Extract yes bid price in cents from market data
 * Handles field migration: checks yes_bid (integer cents) first, then yes_bid_dollars (float)
 * Works both before and after January 15, 2026
 */
function extractYesBidCents(market: any): number | null {
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
 * Fetch all active markets with cursor-based pagination
 * Uses Filter-then-Fetch approach: gets all markets first, then enriches with orderbook
 */
export async function fetchAllMarkets(): Promise<Market[]> {
  const allMarkets: any[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  const maxPages = 100; // Safety limit

  console.log('🔍 Fetching all active markets from Kalshi (with pagination)...');

  do {
    pageCount++;
    if (pageCount > maxPages) {
      console.warn(`⚠️ Reached max pages limit (${maxPages}). Stopping pagination.`);
      break;
    }

    // Build path with cursor if available
    let path = '/markets?status=open';
    if (cursor) {
      path += `&cursor=${cursor}`;
    }

    try {
      const response = await fetch(`${KALSHI_API_BASE}${path}`, {
        method: 'GET',
        headers: createAuthHeaders('GET', path),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kalshi API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Kalshi API returns { markets: [...], cursor: "..." } structure
      const markets = data.markets || [];
      allMarkets.push(...markets);
      
      // Get next cursor for pagination
      cursor = data.cursor || null;
      
      console.log(`   Page ${pageCount}: Fetched ${markets.length} markets (total: ${allMarkets.length})`);
      
      // If no cursor or empty markets, we're done
      if (!cursor || markets.length === 0) {
        break;
      }
    } catch (error: any) {
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
  const path = `/markets/${ticker}/orderbook`;
  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch orderbook: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const orderbook = data.orderbook || data;
  
  // Kalshi orderbook structure: { yes_bids: [{price, size}], yes_asks: [...], no_bids: [...], no_asks: [...] }
  const yesBids = orderbook.yes_bids || orderbook.yesBids || [];
  const yesAsks = orderbook.yes_asks || orderbook.yesAsks || [];
  const noBids = orderbook.no_bids || orderbook.noBids || [];
  const noAsks = orderbook.no_asks || orderbook.noAsks || [];
  
  // Extract best prices and sizes
  const bestYesBid = yesBids.length > 0 ? {
    price: parseFloat(yesBids[0].price || yesBids[0].price_cents || yesBids[0]) / 100,
    size: parseInt(yesBids[0].size || yesBids[0].quantity || '0', 10),
  } : { price: 0, size: 0 };

  const bestYesAsk = yesAsks.length > 0 ? {
    price: parseFloat(yesAsks[0].price || yesAsks[0].price_cents || yesAsks[0]) / 100,
    size: parseInt(yesAsks[0].size || yesAsks[0].quantity || '0', 10),
  } : { price: 0, size: 0 };

  const bestNoBid = noBids.length > 0 ? {
    price: parseFloat(noBids[0].price || noBids[0].price_cents || noBids[0]) / 100,
    size: parseInt(noBids[0].size || noBids[0].quantity || '0', 10),
  } : { price: 0, size: 0 };

  const bestNoAsk = noAsks.length > 0 ? {
    price: parseFloat(noAsks[0].price || noAsks[0].price_cents || noAsks[0]) / 100,
    size: parseInt(noAsks[0].size || noAsks[0].quantity || '0', 10),
  } : { price: 0, size: 0 };

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

  return {
    orderbook: {
      market_id: ticker,
      bestYesBid: bestYesBid.price,
      bestYesAsk: bestYesAsk.price,
      bestNoBid: bestNoBid.price,
      bestNoAsk: bestNoAsk.price,
    },
    liquidity,
    side,
  };
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
 * Reference: https://docs.kalshi.com/reference/get-market
 */
export async function getMarket(ticker: string): Promise<Market> {
  const path = `/markets/${ticker}`;
  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch market: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const market = data.market || data;
  
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
 * Reference: https://docs.kalshi.com/reference/get-portfolio-balance
 */
export async function getAccountBalance(): Promise<number> {
  const path = '/portfolio/balance';
  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch balance: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  // Kalshi returns balance in cents, convert to dollars
  const balance = data.balance || data.available_balance || data.total_balance || 0;
  return balance / 100;
}

/**
 * Place an order on Kalshi
 * Reference: https://docs.kalshi.com/reference/post-portfolio-orders
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

  const path = '/portfolio/orders';
  
  // Convert side to Kalshi format
  const side = order.side === 'YES' || order.side === 'SELL_YES' ? 'yes' : 'no';
  const action = order.side.startsWith('SELL') ? 'sell' : 'buy';
  
  // Kalshi uses price in cents (0-100), count in contracts
  // Price should be integer between 1-99 (cents)
  const orderPrice = Math.max(1, Math.min(99, Math.floor(order.price * 100)));
  
  const body = JSON.stringify({
    ticker: order.market,
    side: side,
    action: action,
    count: Math.floor(order.amount), // Number of contracts
    price: orderPrice, // Price in cents (1-99)
    type: 'limit', // 'limit' or 'market'
  });

  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'POST',
    headers: createAuthHeaders('POST', path, body),
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to place order: ${response.status} ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data.order || data;
}
