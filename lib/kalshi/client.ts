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
function createSignature(method: string, path: string, body?: string): string {
  // Timestamp in milliseconds (not seconds)
  const timestamp = Date.now().toString();
  
  // Build the message to sign: timestamp + method + path + (body if present)
  const message = `${timestamp}${method.toUpperCase()}${path}${body || ''}`;
  
  // Sign with RSA private key
  // Handle both escaped and unescaped newlines
  let privateKey = env.KALSHI_PRIVATE_KEY;
  
  // Replace escaped newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  
  // Ensure proper PEM format
  if (!privateKey.includes('BEGIN RSA PRIVATE KEY') && !privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Invalid private key format: missing BEGIN marker');
  }
  
  try {
    // Use RSA-SHA256 signing
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(message)
      .sign(privateKey, 'base64');
    
    return signature;
  } catch (error: any) {
    console.error('Signature creation error:', error.message);
    throw new Error(`Failed to create signature: ${error.message}. Check private key format.`);
  }
}

/**
 * Create authenticated headers for Kalshi API requests
 * Based on official Kalshi API documentation: https://docs.kalshi.com/getting_started/api_keys
 */
function createAuthHeaders(method: string, path: string, body?: string): Record<string, string> {
  // Timestamp in milliseconds
  const timestamp = Date.now().toString();
  const signature = createSignature(method, path, body);
  
  return {
    'KALSHI-ACCESS-KEY': env.KALSHI_API_ID,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch markets from Kalshi API
 * Reference: https://docs.kalshi.com/reference/get-markets
 */
export async function fetchMarkets(): Promise<Market[]> {
  const path = '/markets';
  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kalshi API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  // Kalshi API returns { markets: [...] } structure
  const markets = data.markets || data.cursor?.markets || [];
  
  return markets.map((market: any) => {
    const yesOdds = parseFloat(market.yes_bid || market.yesBid || market.yes_odds || 0) / 100;
    const noOdds = parseFloat(market.no_bid || market.noBid || market.no_odds || (100 - parseFloat(market.yes_bid || market.yesBid || market.yes_odds || 0))) / 100;
    
    return {
      market_id: market.ticker || market.market_id || market.id,
      question: market.title || market.question || market.subtitle,
      end_date: new Date(market.expiration_time || market.expirationTime || market.end_date),
      yes_odds: yesOdds,
      no_odds: noOdds,
      liquidity: parseFloat(market.liquidity || market.open_interest || 0),
      volume_24h: parseFloat(market.volume || market.volume_24h || 0),
      resolved: market.status === 'closed' || market.status === 'resolved' || false,
      outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
      final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
      resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
    };
  });
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
  
  const yesOdds = parseFloat(market.yes_bid || market.yesBid || market.yes_odds || 0) / 100;
  const noOdds = parseFloat(market.no_bid || market.noBid || market.no_odds || (100 - parseFloat(market.yes_bid || market.yesBid || market.yes_odds || 0))) / 100;
  
  return {
    market_id: market.ticker || market.market_id || market.id,
    question: market.title || market.question || market.subtitle,
    end_date: new Date(market.expiration_time || market.expirationTime || market.end_date),
    yes_odds: yesOdds,
    no_odds: noOdds,
    liquidity: parseFloat(market.liquidity || market.open_interest || 0),
    volume_24h: parseFloat(market.volume || market.volume_24h || 0),
    resolved: market.status === 'closed' || market.status === 'resolved' || false,
    outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
    final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
    resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
  };
}

/**
 * Get orderbook for a specific market
 * Reference: https://docs.kalshi.com/reference/get-orderbook
 */
export async function getOrderbook(ticker: string): Promise<Orderbook> {
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
  
  return {
    market_id: ticker,
    bestYesBid: yesBids.length > 0 ? parseFloat(yesBids[0].price || yesBids[0]) / 100 : 0,
    bestYesAsk: yesAsks.length > 0 ? parseFloat(yesAsks[0].price || yesAsks[0]) / 100 : 0,
    bestNoBid: noBids.length > 0 ? parseFloat(noBids[0].price || noBids[0]) / 100 : 0,
    bestNoAsk: noAsks.length > 0 ? parseFloat(noAsks[0].price || noAsks[0]) / 100 : 0,
  };
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
