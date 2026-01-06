-- Contracts table
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_id TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL,
  end_date TIMESTAMP NOT NULL,
  current_odds DECIMAL(5,4) NOT NULL,
  category TEXT,
  liquidity DECIMAL(12,2),
  volume_24h DECIMAL(12,2),
  discovered_at TIMESTAMP DEFAULT NOW(),
  resolution_source TEXT,
  outcome TEXT, -- YES/NO after resolution
  resolved_at TIMESTAMP
);

-- Trades table
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id),
  executed_at TIMESTAMP DEFAULT NOW(),
  entry_odds DECIMAL(5,4) NOT NULL,
  position_size DECIMAL(10,2) NOT NULL,
  side TEXT NOT NULL, -- 'YES' or 'NO'
  contracts_purchased DECIMAL(12,4),
  ai_confidence DECIMAL(3,2), -- 0-1 score
  ai_reasoning TEXT,
  status TEXT DEFAULT 'open', -- open/won/lost/stopped
  exit_odds DECIMAL(5,4),
  pnl DECIMAL(10,2),
  resolved_at TIMESTAMP
);

-- AI learning table
CREATE TABLE ai_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id),
  contract_snapshot JSONB, -- Full contract data at decision time
  features_analyzed JSONB, -- What factors AI considered
  decision_factors JSONB, -- Weighted reasoning
  confidence_score DECIMAL(3,2),
  allocated_amount DECIMAL(10,2),
  outcome TEXT, -- won/lost after resolution
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance metrics table
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  trades_executed INT,
  win_rate DECIMAL(5,4),
  total_pnl DECIMAL(10,2),
  sharpe_ratio DECIMAL(5,4),
  bankroll DECIMAL(10,2),
  avg_hold_time INTERVAL,
  best_trade_pnl DECIMAL(10,2),
  worst_trade_pnl DECIMAL(10,2),
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT 'default',
  phone_number TEXT,
  email TEXT,
  report_time TIME DEFAULT '07:00:00',
  timezone TEXT DEFAULT 'America/New_York',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Daily reports table
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  trades_executed INT,
  total_invested DECIMAL(10,2),
  open_positions_value DECIMAL(10,2),
  cash_balance DECIMAL(10,2),
  total_liquidity DECIMAL(10,2),
  mtd_pnl DECIMAL(10,2),
  ytd_pnl DECIMAL(10,2),
  mtd_return_pct DECIMAL(5,2),
  ytd_return_pct DECIMAL(5,2),
  win_rate_mtd DECIMAL(5,4),
  win_rate_ytd DECIMAL(5,4),
  report_content TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Stop loss events table
CREATE TABLE stop_loss_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id),
  trigger_odds DECIMAL(5,4) NOT NULL,
  exit_odds DECIMAL(5,4) NOT NULL,
  position_size DECIMAL(10,2) NOT NULL,
  realized_loss DECIMAL(10,2) NOT NULL,
  reason TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Stop loss configuration
CREATE TABLE stop_loss_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_threshold DECIMAL(5,4) DEFAULT 0.80,
  enabled BOOLEAN DEFAULT true,
  min_hold_time_hours INT DEFAULT 1,
  max_slippage_pct DECIMAL(5,4) DEFAULT 0.05,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_contracts_end_date ON contracts(end_date);
CREATE INDEX idx_contracts_market_id ON contracts(market_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_contract_id ON trades(contract_id);
CREATE INDEX idx_trades_executed_at ON trades(executed_at);
CREATE INDEX idx_performance_date ON performance_metrics(date);
CREATE INDEX idx_stop_loss_trade ON stop_loss_events(trade_id);
CREATE INDEX idx_stop_loss_executed_at ON stop_loss_events(executed_at);

-- Error logs table
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP DEFAULT NOW(),
  level TEXT NOT NULL, -- 'error', 'warning', 'info'
  message TEXT NOT NULL,
  error TEXT,
  stack TEXT,
  context JSONB,
  source TEXT, -- 'cron', 'api', 'system'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for error logs
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_level ON error_logs(level);
CREATE INDEX idx_error_logs_source ON error_logs(source);

-- Insert default stop loss config
INSERT INTO stop_loss_config (trigger_threshold, enabled) 
VALUES (0.80, true);

