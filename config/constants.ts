export const TRADING_CONSTANTS = {
  DAILY_BUDGET: Number(process.env.DAILY_BUDGET) || 100, // $100/day - 3 buys totaling $100
  MIN_ODDS: Number(process.env.MIN_ODDS) || 0.85,
  MAX_ODDS: Number(process.env.MAX_ODDS) || 0.98,
  MAX_DAYS_TO_RESOLUTION: Number(process.env.MAX_DAYS_TO_RESOLUTION) || 2,
  MIN_LIQUIDITY: Number(process.env.MIN_LIQUIDITY) || 10000,
  INITIAL_BANKROLL: Number(process.env.INITIAL_BANKROLL) || 100,
  DRY_RUN: process.env.DRY_RUN === 'true',
  
  // Position sizing
  MIN_POSITION_SIZE: 20,
  MAX_POSITION_SIZE: 50,
  
  // Stop loss
  STOP_LOSS_THRESHOLD: 0.80,
  MIN_HOLD_TIME_HOURS: 1,
  MAX_SLIPPAGE_PCT: 0.05,
  
  // Circuit breakers
  MAX_LOSSES_IN_STREAK: 5,
  MAX_STOP_LOSSES_24H: 3,
  BANKROLL_DROP_THRESHOLD: 0.70, // 30% drop
  
  // Excluded categories
  EXCLUDE_CATEGORIES: ['Crypto'],
};

