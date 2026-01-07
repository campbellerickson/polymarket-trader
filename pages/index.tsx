import { useEffect, useState } from 'react';
import Head from 'next/head';
import BottomNav from '../components/BottomNav';

interface DashboardData {
  currentBankroll: number;
  initialBankroll: number;
  totalPnL: number;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  today: {
    pnl: number;
    trades: number;
  };
  week: {
    pnl: number;
    trades: number;
  };
  mtd: {
    pnl: number;
    return: number;
    trades: number;
  };
  ytd: {
    pnl: number;
    return: number;
    trades: number;
  };
  lastUpdated: string;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setData(data);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Head>
          <title>Kalshi Trader Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Kalshi Trader Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="container">
          <div className="error">
            <h2>Error loading dashboard</h2>
            <p>{error}</p>
          </div>
        </div>
      </>
    );
  }

  if (!data) return null;

  return (
    <>
      <Head>
        <title>Cottonwood Investments - Dashboard</title>
        <meta name="description" content="AI-powered prediction market trading" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="header">
        <div className="container">
          <div className="brand">
            <div className="logo">🌲</div>
            <div className="brand-text">
              <h1>Cottonwood Investments</h1>
              <p className="subtitle">AI-Powered Prediction Markets</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '100px' }}>
        <h1 className="section-title">Performance Dashboard</h1>

        {/* Current Bankroll Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Account Balance</div>
              <div className="card-value">${data.currentBankroll.toFixed(2)}</div>
            </div>
          </div>
          <div className="metric-grid">
            <div className="metric">
              <span className="metric-label">Total P&L</span>
              <span className={`metric-value ${data.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                {data.totalPnL >= 0 ? '+' : ''}${data.totalPnL.toFixed(2)}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Return</span>
              <span className={`metric-value ${data.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {data.totalReturn >= 0 ? '+' : ''}{data.totalReturn.toFixed(2)}%
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Win Rate</span>
              <span className="metric-value">{data.winRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Performance Over Time */}
        <h2 className="section-title" style={{ marginTop: '2rem' }}>Performance Over Time</h2>

        {/* Today & This Week */}
        <div className="grid">
          <div className="card">
            <div className="card-title">Today</div>
            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">P&L</span>
                <span className={`metric-value ${data.today.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {data.today.pnl >= 0 ? '+' : ''}${data.today.pnl.toFixed(2)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Trades</span>
                <span className="metric-value">{data.today.trades}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">This Week</div>
            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">P&L</span>
                <span className={`metric-value ${data.week.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {data.week.pnl >= 0 ? '+' : ''}${data.week.pnl.toFixed(2)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Trades</span>
                <span className="metric-value">{data.week.trades}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MTD / YTD Performance */}
        <div className="grid">
          <div className="card">
            <div className="card-title">Month-to-Date</div>
            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">P&L</span>
                <span className={`metric-value ${data.mtd.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {data.mtd.pnl >= 0 ? '+' : ''}${data.mtd.pnl.toFixed(2)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Return</span>
                <span className={`metric-value ${data.mtd.return >= 0 ? 'positive' : 'negative'}`}>
                  {data.mtd.return >= 0 ? '+' : ''}{data.mtd.return.toFixed(2)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Trades</span>
                <span className="metric-value">{data.mtd.trades}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Year-to-Date</div>
            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">P&L</span>
                <span className={`metric-value ${data.ytd.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {data.ytd.pnl >= 0 ? '+' : ''}${data.ytd.pnl.toFixed(2)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Return</span>
                <span className={`metric-value ${data.ytd.return >= 0 ? 'positive' : 'negative'}`}>
                  {data.ytd.return >= 0 ? '+' : ''}{data.ytd.return.toFixed(2)}%
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Trades</span>
                <span className="metric-value">{data.ytd.trades}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div style={{ textAlign: 'center', marginTop: '2rem', opacity: 0.6, fontSize: '0.875rem' }}>
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
