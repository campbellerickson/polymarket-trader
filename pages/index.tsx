import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

interface DashboardData {
  currentBankroll: number;
  initialBankroll: number;
  totalPnL: number;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  openTrades: number;
  mtdPnL: number;
  mtdReturn: number;
  ytdPnL: number;
  ytdReturn: number;
  recentTrades: any[];
  openPositions: any[];
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
      <div className="loading">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <h2>Error loading dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <Head>
        <title>Kalshi Trader Dashboard</title>
        <meta name="description" content="Kalshi automated trading system dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="header">
        <div className="container">
          <nav className="nav">
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Kalshi Trader</h1>
            <Link href="/" className="active">Dashboard</Link>
            <Link href="/logs">Error Logs</Link>
          </nav>
        </div>
      </div>

      <div className="container">
        <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Performance Dashboard</h2>

        {/* Key Metrics */}
        <div className="grid">
          <div className="card">
            <div className="metric">
              <span className="metric-label">Current Bankroll</span>
              <span className="metric-value">${data.currentBankroll.toFixed(2)}</span>
            </div>
          </div>

          <div className="card">
            <div className="metric">
              <span className="metric-label">Total P&L</span>
              <span className={`metric-value ${data.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                {data.totalPnL >= 0 ? '+' : ''}${data.totalPnL.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="metric">
              <span className="metric-label">Total Return</span>
              <span className={`metric-value ${data.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {data.totalReturn >= 0 ? '+' : ''}{data.totalReturn.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="card">
            <div className="metric">
              <span className="metric-label">Win Rate</span>
              <span className="metric-value">{(data.winRate * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="card">
            <div className="metric">
              <span className="metric-label">Total Trades</span>
              <span className="metric-value">{data.totalTrades}</span>
            </div>
          </div>

          <div className="card">
            <div className="metric">
              <span className="metric-label">Open Positions</span>
              <span className="metric-value">{data.openTrades}</span>
            </div>
          </div>
        </div>

        {/* MTD / YTD Performance */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Month-to-Date</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="metric">
                <span className="metric-label">P&L</span>
                <span className={`metric-value ${data.mtdPnL >= 0 ? 'positive' : 'negative'}`}>
                  {data.mtdPnL >= 0 ? '+' : ''}${data.mtdPnL.toFixed(2)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Return</span>
                <span className={`metric-value ${data.mtdReturn >= 0 ? 'positive' : 'negative'}`}>
                  {data.mtdReturn >= 0 ? '+' : ''}{data.mtdReturn.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Year-to-Date</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="metric">
                <span className="metric-label">P&L</span>
                <span className={`metric-value ${data.ytdPnL >= 0 ? 'positive' : 'negative'}`}>
                  {data.ytdPnL >= 0 ? '+' : ''}${data.ytdPnL.toFixed(2)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Return</span>
                <span className={`metric-value ${data.ytdReturn >= 0 ? 'positive' : 'negative'}`}>
                  {data.ytdReturn >= 0 ? '+' : ''}{data.ytdReturn.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Recent Trades</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Contract</th>
                <th>Side</th>
                <th>Entry Odds</th>
                <th>Size</th>
                <th>Status</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTrades.map((trade: any) => (
                <tr key={trade.id}>
                  <td>{new Date(trade.executed_at).toLocaleDateString()}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {trade.contract?.question || 'N/A'}
                  </td>
                  <td>
                    <span className={`badge ${trade.side === 'YES' ? 'success' : 'info'}`}>
                      {trade.side}
                    </span>
                  </td>
                  <td>{(trade.entry_odds * 100).toFixed(1)}%</td>
                  <td>${trade.position_size.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${
                      trade.status === 'won' ? 'success' :
                      trade.status === 'lost' ? 'danger' :
                      trade.status === 'stopped' ? 'warning' : 'info'
                    }`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className={trade.pnl && trade.pnl >= 0 ? 'positive' : 'negative'}>
                    {trade.pnl ? (trade.pnl >= 0 ? '+' : '') + '$' + trade.pnl.toFixed(2) : '-'}
                  </td>
                </tr>
              ))}
              {data.recentTrades.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>
                    No trades yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Open Positions */}
        {data.openPositions.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Open Positions</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Side</th>
                  <th>Entry Odds</th>
                  <th>Current Odds</th>
                  <th>Size</th>
                  <th>Unrealized P&L</th>
                </tr>
              </thead>
              <tbody>
                {data.openPositions.map((pos: any) => (
                  <tr key={pos.trade.id}>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pos.trade.contract?.question || 'N/A'}
                    </td>
                    <td>
                      <span className={`badge ${pos.trade.side === 'YES' ? 'success' : 'info'}`}>
                        {pos.trade.side}
                      </span>
                    </td>
                    <td>{(pos.trade.entry_odds * 100).toFixed(1)}%</td>
                    <td>{(pos.current_odds * 100).toFixed(1)}%</td>
                    <td>${pos.trade.position_size.toFixed(2)}</td>
                    <td className={pos.unrealized_pnl >= 0 ? 'positive' : 'negative'}>
                      {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                      ({pos.unrealized_pnl_pct >= 0 ? '+' : ''}{pos.unrealized_pnl_pct.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

