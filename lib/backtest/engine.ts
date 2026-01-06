import { BacktestConfig, BacktestResult, BacktestTrade, HistoricalMarket } from './types';
import { scanContracts } from '../kalshi/scanner';
import { analyzeContracts } from '../ai/analyzer';
import { loadHistoricalData, generateSampleHistoricalData } from './data-loader';

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  console.log('🧪 Starting backtest...');
  console.log(`   Period: ${config.startDate.toISOString()} to ${config.endDate.toISOString()}`);
  console.log(`   Initial Bankroll: $${config.initialBankroll}`);
  console.log(`   Daily Budget: $${config.dailyBudget}`);
  
  // Load historical data
  let historicalMarkets: HistoricalMarket[];
  
  try {
    historicalMarkets = await loadHistoricalData(config.startDate, config.endDate);
    
    // If no data loaded, generate sample data for testing
    if (historicalMarkets.length === 0) {
      console.log('   ⚠️ No historical data found, generating sample data...');
      historicalMarkets = generateSampleHistoricalData(config.startDate, config.endDate, 50);
    }
  } catch (error) {
    console.log('   ⚠️ Error loading historical data, generating sample data...');
    historicalMarkets = generateSampleHistoricalData(config.startDate, config.endDate, 50);
  }
  
  console.log(`   📊 Loaded ${historicalMarkets.length} historical markets`);
  
  // Simulate trading day by day
  let currentBankroll = config.initialBankroll;
  const trades: BacktestTrade[] = [];
  const dailyReturns: Array<{ date: Date; pnl: number; bankroll: number }> = [];
  
  const currentDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  
  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    
    // Get markets available on this day
    const availableMarkets = historicalMarkets.filter(m => {
      const marketStart = new Date(m.end_date);
      marketStart.setDate(marketStart.getDate() - 7); // Market starts 7 days before resolution
      return marketStart <= dayEnd && m.end_date >= dayStart;
    });
    
    if (availableMarkets.length > 0) {
      // Get current odds for each market on this day
      const contracts = availableMarkets
        .map(m => {
          const oddsSnapshot = m.historical_odds.find(
            ho => ho.timestamp >= dayStart && ho.timestamp <= dayEnd
          ) || m.historical_odds[m.historical_odds.length - 1];
          
          return {
            id: '',
            market_id: m.market_id,
            question: m.question,
            end_date: m.end_date,
            current_odds: oddsSnapshot.yes_odds,
            liquidity: oddsSnapshot.liquidity,
            volume_24h: oddsSnapshot.volume_24h,
            discovered_at: dayStart,
          };
        })
        .filter(c => {
          const daysToResolution = (c.end_date.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24);
          return (
            c.current_odds >= config.minOdds &&
            c.current_odds <= config.maxOdds &&
            daysToResolution <= config.maxDaysToResolution &&
            c.liquidity >= config.minLiquidity
          );
        });
      
      if (contracts.length > 0 && currentBankroll >= config.dailyBudget) {
        // Execute trades for this day
        let dayTrades: BacktestTrade[] = [];
        
        if (config.useAI) {
          // Use AI analysis (simplified - would need to mock AI responses)
          dayTrades = await simulateAITrades(contracts, currentBankroll, config.dailyBudget, dayStart);
        } else {
          // Simple strategy: equal allocation across top 3 contracts
          dayTrades = simulateSimpleTrades(contracts, config.dailyBudget, dayStart);
        }
        
        // Execute trades
        for (const trade of dayTrades) {
          const allocation = Math.min(trade.positionSize, currentBankroll);
          trade.positionSize = allocation;
          trade.contractsPurchased = allocation / trade.entryOdds;
          currentBankroll -= allocation;
          trades.push(trade);
        }
      }
    }
    
    // Check for stop losses and resolutions
    const dayPnL = await processDayResolutions(trades, availableMarkets, dayStart, config);
    currentBankroll += dayPnL;
    
    // Record daily return
    dailyReturns.push({
      date: new Date(dayStart),
      pnl: dayPnL,
      bankroll: currentBankroll,
    });
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculate final metrics
  const resolvedTrades = trades.filter(t => t.status !== 'open');
  const winningTrades = resolvedTrades.filter(t => t.status === 'won');
  const losingTrades = resolvedTrades.filter(t => t.status === 'lost');
  const stoppedTrades = resolvedTrades.filter(t => t.status === 'stopped');
  
  const totalPnL = resolvedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalReturn = ((currentBankroll - config.initialBankroll) / config.initialBankroll) * 100;
  const winRate = resolvedTrades.length > 0 ? winningTrades.length / resolvedTrades.length : 0;
  
  const sharpeRatio = calculateSharpeRatio(dailyReturns);
  const maxDrawdown = calculateMaxDrawdown(dailyReturns);
  
  console.log('\n📊 Backtest Results:');
  console.log(`   Total Trades: ${trades.length}`);
  console.log(`   Win Rate: ${(winRate * 100).toFixed(2)}%`);
  console.log(`   Total P&L: $${totalPnL.toFixed(2)}`);
  console.log(`   Total Return: ${totalReturn.toFixed(2)}%`);
  console.log(`   Final Bankroll: $${currentBankroll.toFixed(2)}`);
  console.log(`   Sharpe Ratio: ${sharpeRatio.toFixed(2)}`);
  console.log(`   Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
  
  return {
    config,
    startDate: config.startDate,
    endDate: config.endDate,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    stoppedTrades: stoppedTrades.length,
    winRate,
    totalPnL,
    totalReturn,
    sharpeRatio,
    maxDrawdown,
    finalBankroll: currentBankroll,
    dailyReturns,
    trades,
  };
}

async function simulateAITrades(
  contracts: any[],
  bankroll: number,
  dailyBudget: number,
  entryDate: Date
): Promise<BacktestTrade[]> {
  // Simplified AI simulation - in real backtest, you'd use actual AI or cached responses
  const selected = contracts.slice(0, Math.min(3, contracts.length));
  const allocation = dailyBudget / selected.length;
  
  return selected.map(c => ({
    market_id: c.market_id,
    question: c.question,
    entryDate,
    entryOdds: c.current_odds,
    positionSize: allocation,
    contractsPurchased: 0, // Will be calculated
    side: 'YES' as const,
    status: 'open' as const,
    aiConfidence: 0.85,
    aiReasoning: 'Simulated AI decision',
  }));
}

function simulateSimpleTrades(
  contracts: any[],
  dailyBudget: number,
  entryDate: Date
): BacktestTrade[] {
  const selected = contracts
    .sort((a, b) => b.current_odds - a.current_odds)
    .slice(0, Math.min(3, contracts.length));
  
  const allocation = dailyBudget / selected.length;
  
  return selected.map(c => ({
    market_id: c.market_id,
    question: c.question,
    entryDate,
    entryOdds: c.current_odds,
    positionSize: allocation,
    contractsPurchased: 0,
    side: 'YES' as const,
    status: 'open' as const,
  }));
}

async function processDayResolutions(
  trades: BacktestTrade[],
  markets: HistoricalMarket[],
  date: Date,
  config: BacktestConfig
): Promise<number> {
  let dayPnL = 0;
  
  for (const trade of trades.filter(t => t.status === 'open')) {
    const market = markets.find(m => m.market_id === trade.market_id);
    if (!market) continue;
    
    // Check stop loss
    const currentOdds = market.historical_odds
      .filter(ho => ho.timestamp <= date)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (currentOdds && currentOdds.yes_odds < config.stopLossThreshold) {
      const holdTime = date.getTime() - trade.entryDate.getTime();
      const minHoldTime = 60 * 60 * 1000; // 1 hour
      
      if (holdTime >= minHoldTime) {
        // Trigger stop loss
        trade.exitDate = date;
        trade.exitOdds = currentOdds.yes_odds;
        trade.status = 'stopped';
        trade.pnl = (trade.contractsPurchased * currentOdds.yes_odds) - trade.positionSize;
        dayPnL += trade.pnl;
        continue;
      }
    }
    
    // Check resolution
    if (market.resolved && market.resolved_at && market.resolved_at <= date) {
      trade.exitDate = market.resolved_at;
      trade.exitOdds = market.outcome === 'YES' ? 1.0 : 0.0;
      trade.status = market.outcome === trade.side ? 'won' : 'lost';
      
      if (trade.status === 'won') {
        trade.pnl = (trade.contractsPurchased * 1.0) - trade.positionSize;
      } else {
        trade.pnl = -trade.positionSize;
      }
      
      dayPnL += trade.pnl;
    }
  }
  
  return dayPnL;
}

function calculateSharpeRatio(dailyReturns: Array<{ pnl: number }>): number {
  if (dailyReturns.length < 2) return 0;
  
  const returns = dailyReturns.map(d => d.pnl);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  return (avgReturn / stdDev) * Math.sqrt(252); // Annualized
}

function calculateMaxDrawdown(dailyReturns: Array<{ bankroll: number }>): number {
  if (dailyReturns.length === 0) return 0;
  
  let peak = dailyReturns[0].bankroll;
  let maxDrawdown = 0;
  
  for (const day of dailyReturns) {
    if (day.bankroll > peak) {
      peak = day.bankroll;
    }
    const drawdown = ((peak - day.bankroll) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

