import { env } from '../../config/env';
import { Market, Orderbook } from '../../types';
import crypto from 'crypto';

const POLYMARKET_API_BASE = 'https://clob.polymarket.com';

/**
 * Create authenticated headers for Polymarket API requests
 * Polymarket CLOB API uses apiKey, secret, and passphrase for authentication
 * Similar to Coinbase Pro style authentication
 */
function createAuthHeaders(method: string, path: string, body?: string): Record<string, string> {
  const timestamp = Date.now().toString();
  const message = timestamp + method.toUpperCase() + path + (body || '');
  
  // Create signature using secret (base64 decode first)
  const secretBuffer = Buffer.from(env.POLYMARKET_SECRET, 'base64');
  const signature = crypto
    .createHmac('sha256', secretBuffer)
    .update(message)
    .digest('base64');
  
  return {
    'POLY_API_KEY': env.POLYMARKET_API_KEY,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp,
    'POLY_PASSPHRASE': env.POLYMARKET_PASSPHRASE,
    'Content-Type': 'application/json',
  };
}

export async function fetchMarkets(): Promise<Market[]> {
  const path = '/markets';
  const response = await fetch(`${POLYMARKET_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Transform Polymarket API response to our Market format
  return data.map((market: any) => ({
    market_id: market.id || market.market_id,
    question: market.question || market.title,
    end_date: new Date(market.end_date || market.endDate),
    yes_odds: parseFloat(market.yes_odds || market.yesOdds || 0),
    no_odds: parseFloat(market.no_odds || market.noOdds || 0),
    liquidity: parseFloat(market.liquidity || 0),
    volume_24h: parseFloat(market.volume_24h || market.volume24h || 0),
    resolved: market.resolved || false,
    outcome: market.outcome,
    final_odds: market.final_odds ? parseFloat(market.final_odds) : undefined,
    resolved_at: market.resolved_at ? new Date(market.resolved_at) : undefined,
  }));
}

export async function getMarket(marketId: string): Promise<Market> {
  const path = `/markets/${marketId}`;
  const response = await fetch(`${POLYMARKET_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch market: ${response.statusText}`);
  }

  const market = await response.json();
  
  return {
    market_id: market.id || market.market_id,
    question: market.question || market.title,
    end_date: new Date(market.end_date || market.endDate),
    yes_odds: parseFloat(market.yes_odds || market.yesOdds || 0),
    no_odds: parseFloat(market.no_odds || market.noOdds || 0),
    liquidity: parseFloat(market.liquidity || 0),
    volume_24h: parseFloat(market.volume_24h || market.volume24h || 0),
    resolved: market.resolved || false,
    outcome: market.outcome,
    final_odds: market.final_odds ? parseFloat(market.final_odds) : undefined,
    resolved_at: market.resolved_at ? new Date(market.resolved_at) : undefined,
  };
}

export async function getOrderbook(marketId: string): Promise<Orderbook> {
  const path = `/markets/${marketId}/orderbook`;
  const response = await fetch(`${POLYMARKET_API_BASE}${path}`, {
    method: 'GET',
    headers: createAuthHeaders('GET', path),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch orderbook: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    market_id: marketId,
    bestYesBid: parseFloat(data.best_yes_bid || data.bestYesBid || 0),
    bestYesAsk: parseFloat(data.best_yes_ask || data.bestYesAsk || 0),
    bestNoBid: parseFloat(data.best_no_bid || data.bestNoBid || 0),
    bestNoAsk: parseFloat(data.best_no_ask || data.bestNoAsk || 0),
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

  const path = '/orders';
  const body = JSON.stringify({
    market: order.market,
    side: order.side,
    amount: order.amount.toString(),
    price: order.price.toString(),
  });

  const response = await fetch(`${POLYMARKET_API_BASE}${path}`, {
    method: 'POST',
    headers: createAuthHeaders('POST', path, body),
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to place order: ${error}`);
  }

  return await response.json();
}

