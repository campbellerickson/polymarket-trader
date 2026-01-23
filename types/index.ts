export interface Contract {
  id: string;
  market_id: string;
  question: string;
  end_date: Date;
  yes_odds: number;
  no_odds?: number;
  category?: string;
  liquidity: number;
  volume_24h: number;
  discovered_at: Date;
  resolution_source?: string;
  outcome?: 'YES' | 'NO';
  resolved_at?: Date;
}

export interface Trade {
  id: string;
  contract_id: string;
  contract: Contract;
  executed_at: Date;
  entry_odds: number;
  position_size: number;
  side: 'YES' | 'NO';
  contracts_purchased: number;
  ai_confidence: number;
  ai_reasoning: string;
  risk_factors?: string[]; // Risk factors identified by AI
  status: 'open' | 'won' | 'lost' | 'stopped' | 'cancelled' | 'take_profit';
  exit_odds?: number;
  pnl?: number;
  resolved_at?: Date;
}

export interface ScanCriteria {
  minOdds: number;
  maxOdds: number;
  maxDaysToResolution: number;
  minLiquidity: number;
  excludeCategories?: string[];
  excludeKeywords?: string[];
}

export interface AnalysisRequest {
  contracts: Contract[];
  historicalPerformance: Trade[];
  currentBankroll: number;
  dailyBudget: number;
}

export interface AnalysisResponse {
  selectedContracts: {
    contract: Contract;
    allocation: number;
    confidence: number;
    reasoning: string;
    riskFactors: string[];
  }[];
  totalAllocated: number;
  strategyNotes: string;
  forcedTrade?: boolean; // If true, stop after first successful trade
}

export interface TradeResult {
  success: boolean;
  trade?: Trade;
  error?: string;
  contract?: Contract;
}

export interface Position {
  trade: Trade;
  yes_odds: number;
  no_odds?: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export interface StopLossEvent {
  id: string;
  trade_id: string;
  trade: Trade;
  trigger_odds: number;
  exit_odds: number;
  position_size: number;
  realized_loss: number;
  reason: string;
  executed_at: Date;
}

export interface DailyReportData {
  reportDate: Date;
  tradesExecuted: Trade[];
  totalInvested: number;
  openPositions: Position[];
  openPositionsValue: number;
  cashBalance: number;
  totalLiquidity: number;
  mtdPnL: number;
  mtdReturnPct: number;
  mtdWinRate: number;
  mtdTrades: number;
  ytdPnL: number;
  ytdReturnPct: number;
  ytdWinRate: number;
  ytdTrades: number;
  currentBankroll: number;
  initialBankroll: number;
}

export interface Market {
  market_id: string;
  question: string;
  end_date: Date;
  yes_odds: number;
  no_odds: number;
  liquidity: number;
  volume_24h: number;
  resolved: boolean;
  category?: string;
  outcome?: 'YES' | 'NO';
  final_odds?: number;
  resolved_at?: Date;
}

export interface Orderbook {
  market_id: string;
  bestYesBid: number;
  bestYesAsk: number;
  bestNoBid: number;
  bestNoAsk: number;
}

