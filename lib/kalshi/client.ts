import { env } from '../../config/env';
import { Market, Orderbook } from '../../types';
import crypto from 'crypto';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Create signature for Kalshi API authentication
 * Kalshi uses RSA-PSS signature with the private key
 */
function createSignature(method: string, path: string, body?: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${timestamp}${method.toUpperCase()}${path}${body || ''}`;
  
  // Sign with RSA private key using PSS padding
  const privateKey = env.KALSHI_PRIVATE_KEY.replace(/\\n/g, '\n');
  
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(message)
    .sign(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      'base64'
    );
  
  return signature;
}

/**
 * Create authenticated headers for Kalshi API requests
 */
function createAuthHeaders(method: string, path: string, body?: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createSignature(method, path, body);
  
  return {
    'X-Kalshi-Api-Key': env.KALSHI_API_ID,
    'X-Kalshi-Timestamp': timestamp,
    'X-Kalshi-Signature': signature,
    'Content-Type': 'application/json',
  };
}

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
  
  // Transform Kalshi API response to our Market format
  // Kalshi returns markets in a different structure
  const markets = data.markets || data || [];
  
  return markets.map((market: any) => ({
    market_id: market.ticker || market.market_id || market.id,
    question: market.title || market.question || market.subtitle,
    end_date: new Date(market.expiration_time || market.expirationTime || market.end_date),
    current_odds: parseFloat(market.yes_bid || market.yesBid || market.yes_odds || 0) / 100, // Kalshi uses 0-100 scale
    liquidity: parseFloat(market.liquidity || market.open_interest || 0),
    volume_24h: parseFloat(market.volume || market.volume_24h || 0),
    resolved: market.status === 'closed' || market.status === 'resolved' || false,
    outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
    final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
    resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
  }));
}

export async function getMarket(marketId: string): Promise<Market> {
  const path = `/markets/${marketId}`;
  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch market: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const market = await response.json();
  
  return {
    market_id: market.ticker || market.market_id || market.id,
    question: market.title || market.question || market.subtitle,
    end_date: new Date(market.expiration_time || market.expirationTime || market.end_date),
    current_odds: parseFloat(market.yes_bid || market.yesBid || market.yes_odds || 0) / 100,
    liquidity: parseFloat(market.liquidity || market.open_interest || 0),
    volume_24h: parseFloat(market.volume || market.volume_24h || 0),
    resolved: market.status === 'closed' || market.status === 'resolved' || false,
    outcome: market.result ? (market.result === 'yes' ? 'YES' : 'NO') : undefined,
    final_odds: market.result_price ? parseFloat(market.result_price) / 100 : undefined,
    resolved_at: market.settlement_time ? new Date(market.settlement_time) : undefined,
  };
}

export async function getOrderbook(marketId: string): Promise<Orderbook> {
  const path = `/markets/${marketId}/orderbook`;
  const response = await fetch(`${KALSHI_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch orderbook: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  // Kalshi orderbook structure
  const yesBids = data.yes_bids || data.yesBids || [];
  const yesAsks = data.yes_asks || data.yesAsks || [];
  const noBids = data.no_bids || data.noBids || [];
  const noAsks = data.no_asks || data.noAsks || [];
  
  return {
    market_id: marketId,
    bestYesBid: yesBids.length > 0 ? parseFloat(yesBids[0].price || yesBids[0]) / 100 : 0,
    bestYesAsk: yesAsks.length > 0 ? parseFloat(yesAsks[0].price || yesAsks[0]) / 100 : 0,
    bestNoBid: noBids.length > 0 ? parseFloat(noBids[0].price || noBids[0]) / 100 : 0,
    bestNoAsk: noAsks.length > 0 ? parseFloat(noAsks[0].price || noAsks[0]) / 100 : 0,
  };
}

export async function placeOrder(order: {
  market: string;
  side: 'YES' | 'NO' | 'SELL_YES' | 'SELL_NO';
  amount: number;
  price: number;
}): Promise<any> {
  if (process.env.DRY_RUN === 'true') {
    console.log('🧪 DRY RUN: Would place order:', order);
    return { id: 'dry-run-order', status: 'filled' };
  }

  const path = '/portfolio/orders';
  
  // Convert side to Kalshi format
  const side = order.side === 'YES' || order.side === 'SELL_YES' ? 'yes' : 'no';
  const action = order.side.startsWith('SELL') ? 'sell' : 'buy';
  
  // Kalshi uses price in cents (0-100), quantity in contracts
  const body = JSON.stringify({
    ticker: order.market,
    side: side,
    action: action,
    count: Math.floor(order.amount), // Number of contracts
    price: Math.floor(order.price * 100), // Convert to cents (0-100)
    type: 'limit', // or 'market'
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

  return await response.json();
}
