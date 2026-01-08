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

      // Trigger if position has lost 20%+ of its value (works for both YES and NO)
      const valueRatio = currentValue / trade.position_size;
      const shouldTrigger =
        valueRatio < config.triggerThreshold && // Position lost 20%+ (default: 0.80)
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
        console.log(`🚨 STOP LOSS THRESHOLD HIT: ${trade.contract.question.substring(0, 50)}...`);
        console.log(`   Entry: ${(trade.entry_odds * 100).toFixed(1)}% → Current: ${(currentOdds * 100).toFixed(1)}%`);
        console.log(`   Unrealized Loss: $${unrealizedLoss.toFixed(2)} (${unrealizedLossPct.toFixed(1)}%)`);
        console.log(`   🤖 Consulting AI for decision...`);

        // Let AI research and decide whether to actually sell
        const aiDecision = await getAIStopLossDecision(trade, currentOdds, candidate);

        console.log(`   AI Decision: ${aiDecision.shouldSell ? '❌ SELL' : '✅ HOLD'}`);
        console.log(`   Reasoning: ${aiDecision.reasoning.substring(0, 100)}...`);

        // Log the AI decision to database
        await logStopLossAIDecision(trade.id, aiDecision);

        // Only execute if AI recommends selling
        if (aiDecision.shouldSell) {
          const result = await executeStopLoss(trade, currentOdds, aiDecision.reasoning, config);

          if (result.success && result.event) {
            triggered.push(result.event);
          }
        } else {
          console.log(`   ✅ Holding position based on AI recommendation`);
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

/**
 * Ask AI to research market conditions and decide whether to execute stop-loss
 */
async function getAIStopLossDecision(
  trade: Trade,
  currentOdds: number,
  candidate: StopLossCandidate
): Promise<{ shouldSell: boolean; reasoning: string; confidence: number }> {
  const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const prompt = `You are an expert Kalshi trader evaluating whether to execute a stop-loss sell.

POSITION DETAILS:
- Market: ${trade.contract.question}
- Side: ${trade.side}
- Entry Odds: ${(trade.entry_odds * 100).toFixed(1)}%
- Current Odds: ${(currentOdds * 100).toFixed(1)}%
- Position Size: $${trade.position_size.toFixed(2)}
- Contracts: ${trade.contracts_purchased}
- Unrealized Loss: $${candidate.unrealizedLoss.toFixed(2)} (${candidate.unrealizedLossPct.toFixed(1)}%)
- Hold Time: ${candidate.holdTimeHours.toFixed(1)} hours

SITUATION:
The position has dropped ${Math.abs(candidate.unrealizedLossPct).toFixed(1)}% and triggered our stop-loss threshold.

YOUR TASK:
1. RESEARCH the market: What likely caused this price drop? Is it based on new information, or just temporary volatility?
2. ANALYZE recovery likelihood: Based on the event type and current market conditions, how likely is this position to recover?
3. DECIDE: Should we sell now to limit losses, or hold because it's likely to recover?

Consider:
- Event type (sports, politics, economics, etc.)
- Time remaining until resolution
- Magnitude of the drop (is it catastrophic or manageable?)
- Recent news or developments
- Whether the underlying thesis has changed

Respond in JSON:
{
  "shouldSell": boolean,
  "confidence": 0-1,
  "reasoning": "Detailed explanation of research findings and decision rationale"
}

Be conservative: If the fundamental thesis has changed or recovery is unlikely, recommend selling.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_completion_tokens: 2000,
        temperature: 0.3, // Lower temperature for more conservative decisions
        messages: [
          { role: 'system', content: 'You are an expert Kalshi trader making stop-loss decisions based on research and analysis.' },
          { role: 'user', content: prompt },
        ],
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: any = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      shouldSell: parsed.shouldSell ?? true, // Default to selling if unclear
      confidence: parsed.confidence ?? 0.5,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error: any) {
    console.error('❌ AI decision failed:', error.message);
    // Default to selling if AI fails (conservative approach)
    return {
      shouldSell: true,
      confidence: 0.5,
      reasoning: `AI decision failed: ${error.message}. Defaulting to sell for safety.`,
    };
  }
}

/**
 * Log AI stop-loss decision to database
 */
async function logStopLossAIDecision(
  tradeId: string,
  decision: { shouldSell: boolean; reasoning: string; confidence: number }
): Promise<void> {
  try {
    await supabase
      .from('stop_loss_ai_decisions')
      .insert({
        trade_id: tradeId,
        should_sell: decision.shouldSell,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        created_at: new Date().toISOString(),
      });
  } catch (error: any) {
    console.error('Failed to log AI decision:', error.message);
    // Don't throw - logging shouldn't block execution
  }
}

