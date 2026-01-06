#!/usr/bin/env tsx

import { runBacktest } from './engine';
import { BacktestConfig } from './types';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments or use defaults
  const startDate = args[0] ? new Date(args[0]) : new Date('2024-01-01');
  const endDate = args[1] ? new Date(args[1]) : new Date('2024-12-31');
  const initialBankroll = args[2] ? parseFloat(args[2]) : 1000;
  const useAI = args[3] === 'true';
  
  const config: BacktestConfig = {
    startDate,
    endDate,
    initialBankroll,
    dailyBudget: 100,
    minOdds: 0.90,
    maxOdds: 0.98,
    maxDaysToResolution: 2,
    minLiquidity: 10000,
    stopLossThreshold: 0.80,
    useAI,
  };
  
  console.log('🚀 Starting Kalshi Backtest\n');
  
  const result = await runBacktest(config);
  
  // Output results
  console.log('\n' + '='.repeat(60));
  console.log('BACKTEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Period: ${result.startDate.toISOString().split('T')[0]} to ${result.endDate.toISOString().split('T')[0]}`);
  console.log(`Total Trades: ${result.totalTrades}`);
  console.log(`Winning: ${result.winningTrades} | Losing: ${result.losingTrades} | Stopped: ${result.stoppedTrades}`);
  console.log(`Win Rate: ${(result.winRate * 100).toFixed(2)}%`);
  console.log(`Total P&L: $${result.totalPnL.toFixed(2)}`);
  console.log(`Total Return: ${result.totalReturn.toFixed(2)}%`);
  console.log(`Final Bankroll: $${result.finalBankroll.toFixed(2)}`);
  console.log(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
  console.log(`Max Drawdown: ${result.maxDrawdown.toFixed(2)}%`);
  console.log('='.repeat(60));
  
  // Save results to file
  const fs = await import('fs/promises');
  const outputPath = `backtest-results-${Date.now()}.json`;
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n📁 Results saved to: ${outputPath}`);
}

main().catch(console.error);

