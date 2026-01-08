import { getOpenTrades, getTrade, updateTrade, getRecentStopLosses } from '../database/queries';
import { getMarket, getOrderbook, placeOrder } from '../kalshi/client';
import { supabase } from '../database/client';
import { sendSMS } from '../notifications/sms';
import { Trade, StopLossEvent } from '../../types';
import { TRADING_CONSTANTS } from '../../config/constants';

interface StopLossConfig {
  triggerThreshold: number;
  enabled: boolean;
  minHoldTimeHours: number;
  maxSlippagePct: number;
}

interface StopLossCandidate {
  trade: Trade;
  currentOdds: number;
  entryOdds: number;
  unrealizedLoss: number;
  unrealizedLossPct: number;
  holdTimeHours: number;
  shouldTrigger: boolean;
  reason: string;
}

interface StopLossResult {
  triggered: number;
  candidates: StopLossCandidate[];
  events: StopLossEvent[];
}

export async function monitorStopLosses(): Promise<StopLossResult> {
  console.log('🛡️ Checking stop loss conditions...');
  
  const config = await getStopLossConfig();
  
  if (!config.enabled) {
    console.log('⏸️ Stop loss monitoring disabled');
    return { triggered: 0, candidates: [], events: [] };
  }
  
  const openTrades = await getOpenTrades();
  console.log(`📊 Monitoring ${openTrades.length} open positions`);
  
  const candidates: StopLossCandidate[] = [];
  const triggered: StopLossEvent[] = [];
  
  for (const trade of openTrades) {
    try {
      const market = await getMarket(trade.contract.market_id);

      // Skip resolved markets - they should be handled by the resolver, not stop-loss
      if (market.resolved) {
        console.log(`   ⏭️ Skipping resolved market: ${trade.contract.question.substring(0, 50)}...`);
        continue;
      }

      const currentOdds = trade.side === 'YES' ? market.yes_odds : market.no_odds;

      // Skip if current value is 0% - indicates market has resolved/closed trading
      if (currentOdds === 0) {
        console.log(`   ⏭️ Skipping market at 0% (resolved/closed): ${trade.contract.question.substring(0, 50)}...`);
        continue;
      }

      const currentValue = trade.contracts_purchased * currentOdds;
      const unrealizedLoss = currentValue - trade.position_size;
      const unrealizedLossPct = (unrealizedLoss / trade.position_size) * 100;

      const holdTimeHours = (Date.now() - new Date(trade.executed_at).getTime()) / (1000 * 60 * 60);

      const shouldTrigger =
        currentOdds < config.triggerThreshold &&
        holdTimeHours >= config.minHoldTimeHours;
      
      const candidate: StopLossCandidate = {
        trade,
        currentOdds,
        entryOdds: trade.entry_odds,
        unrealizedLoss,
        unrealizedLossPct,
        holdTimeHours,
        shouldTrigger,
        reason: shouldTrigger 
          ? `Odds dropped from ${(trade.entry_odds * 100).toFixed(1)}% to ${(currentOdds * 100).toFixed(1)}%`
          : 'Not triggered'
      };
      
      candidates.push(candidate);
      
      if (shouldTrigger) {
        console.log(`🚨 STOP LOSS TRIGGERED: ${trade.contract.question.substring(0, 50)}...`);
        console.log(`   Entry: ${(trade.entry_odds * 100).toFixed(1)}% → Current: ${(currentOdds * 100).toFixed(1)}%`);
        console.log(`   Unrealized Loss: $${unrealizedLoss.toFixed(2)} (${unrealizedLossPct.toFixed(1)}%)`);
        
        const result = await executeStopLoss(trade, currentOdds, candidate.reason, config);
        
        if (result.success && result.event) {
          triggered.push(result.event);
        }
      }
    } catch (error: any) {
      console.error(`   ⚠️ Error checking trade ${trade.id}:`, error.message);
    }
  }
  
  console.log(`\n📊 Stop Loss Summary:`);
  console.log(`   Total positions: ${openTrades.length}`);
  console.log(`   Below threshold: ${candidates.filter(c => c.currentOdds < config.triggerThreshold).length}`);
  console.log(`   Triggered: ${triggered.length}`);
  
  if (triggered.length > 0) {
    const totalLoss = triggered.reduce((sum, e) => sum + e.realized_loss, 0);
    console.log(`   Total realized loss: $${totalLoss.toFixed(2)}`);
    
    await sendStopLossAlert(triggered);
  }
  
  return {
    triggered: triggered.length,
    candidates,
    events: triggered
  };
}

async function executeStopLoss(
  trade: Trade,
  currentOdds: number,
  reason: string,
  config: StopLossConfig
): Promise<{ success: boolean; event?: StopLossEvent; error?: string }> {
  try {
    const orderbook = await getOrderbook(trade.contract.market_id);

    const bestBid = trade.side === 'YES' ? orderbook.bestYesBid : orderbook.bestNoBid;
    const slippage = Math.abs(bestBid - currentOdds) / currentOdds;

    if (slippage > config.maxSlippagePct) {
      console.log(`⚠️ Slippage too high (${(slippage * 100).toFixed(2)}%), skipping`);
      return {
        success: false,
        error: `Slippage ${(slippage * 100).toFixed(2)}% exceeds max ${(config.maxSlippagePct * 100).toFixed(2)}%`
      };
    }

    // Sell ALL contracts we own at current market price
    console.log(`   Selling ${trade.contracts_purchased} ${trade.side} contracts @ ${(bestBid * 100).toFixed(1)}%`);

    const order = await placeOrder({
      market: trade.contract.market_id,
      side: trade.side === 'YES' ? 'SELL_YES' : 'SELL_NO',
      amount: 0, // Not used when count is specified
      price: Math.max(0.01, bestBid), // Ensure price is at least 1 cent (Kalshi minimum)
      count: trade.contracts_purchased, // Explicit count: sell all contracts
      type: 'market'
    });

    const proceeds = trade.contracts_purchased * bestBid;
    const realizedLoss = proceeds - trade.position_size;
    
    await updateTrade(trade.id, {
      status: 'stopped',
      exit_odds: bestBid,
      pnl: realizedLoss,
      resolved_at: new Date(),
    });
    
    const event = await logStopLossEvent({
      trade_id: trade.id,
      trigger_odds: config.triggerThreshold,
      exit_odds: bestBid,
      position_size: trade.position_size,
      realized_loss: realizedLoss,
      reason
    });
    
    console.log(`✅ Stop loss executed:`);
    console.log(`   Sold ${trade.contracts_purchased} contracts @ ${(bestBid * 100).toFixed(1)}%`);
    console.log(`   Realized loss: $${realizedLoss.toFixed(2)}`);
    
    return { success: true, event };
    
  } catch (error: any) {
    console.error(`❌ Failed to execute stop loss:`, error.message);
    return { success: false, error: error.message };
  }
}

async function getStopLossConfig(): Promise<StopLossConfig> {
  const { data, error } = await supabase
    .from('stop_loss_config')
    .select('*')
    .single();
  
  if (error || !data) {
    return {
      triggerThreshold: TRADING_CONSTANTS.STOP_LOSS_THRESHOLD,
      enabled: true,
      minHoldTimeHours: TRADING_CONSTANTS.MIN_HOLD_TIME_HOURS,
      maxSlippagePct: TRADING_CONSTANTS.MAX_SLIPPAGE_PCT,
    };
  }
  
  return {
    triggerThreshold: parseFloat(data.trigger_threshold),
    enabled: data.enabled,
    minHoldTimeHours: data.min_hold_time_hours,
    maxSlippagePct: parseFloat(data.max_slippage_pct),
  };
}

async function logStopLossEvent(event: {
  trade_id: string;
  trigger_odds: number;
  exit_odds: number;
  position_size: number;
  realized_loss: number;
  reason: string;
}): Promise<StopLossEvent> {
  const { data, error } = await supabase
    .from('stop_loss_events')
    .insert({
      ...event,
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as StopLossEvent;
}

async function sendStopLossAlert(events: StopLossEvent[]): Promise<void> {
  const totalLoss = events.reduce((sum, e) => sum + e.realized_loss, 0);
  
  const message = `
🚨 STOP LOSS TRIGGERED

${events.length} position${events.length > 1 ? 's' : ''} sold:

${events.map(e => {
  const pct = (e.realized_loss / e.position_size) * 100;
  return `• ${e.reason.substring(0, 50)}
  Loss: $${Math.abs(e.realized_loss).toFixed(2)} (${pct.toFixed(1)}%)`;
}).join('\n\n')}

Total realized loss: $${Math.abs(totalLoss).toFixed(2)}
  `.trim();
  
  // Log stop loss alert (notifications removed)
  console.log('🚨 STOP LOSS ALERT:', message);
  await sendSMS('admin', message);
}

export async function checkCircuitBreaker(events: StopLossEvent[]): Promise<void> {
  const recentStopLosses = await getRecentStopLosses(24);
  
  if (recentStopLosses.length >= 3) {
    console.log('🔴 CIRCUIT BREAKER: 3+ stop losses in 24 hours');
    
    await supabase
      .from('stop_loss_config')
      .update({ enabled: false })
      .eq('id', 1);
    
    // Log circuit breaker (notifications removed)
    const circuitBreakerMessage = `🔴 CIRCUIT BREAKER ACTIVATED\n\n3+ stop losses triggered in 24 hours.\nTrading has been automatically halted.`;
    console.error('🔴 CIRCUIT BREAKER:', circuitBreakerMessage);
    await sendSMS('admin', circuitBreakerMessage);
  }
}

