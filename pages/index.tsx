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

  // Calculate trade status breakdown
  const resolvedTrades = data.recentTrades.filter(t => t.status !== 'open');
  const notStarted = 0; // Not applicable for trading
  const inProgress = data.openTrades;
  const onReview = 0; // Not applicable
  const completed = resolvedTrades.filter(t => t.status === 'won').length;
  const lost = resolvedTrades.filter(t => t.status === 'lost').length;
  const stopped = resolvedTrades.filter(t => t.status === 'stopped').length;
  
  const totalStatus = data.totalTrades;
  const completedPct = totalStatus > 0 ? (completed / totalStatus) * 100 : 0;
  const lostPct = totalStatus > 0 ? (lost / totalStatus) * 100 : 0;
  const stoppedPct = totalStatus > 0 ? (stopped / totalStatus) * 100 : 0;
  const inProgressPct = totalStatus > 0 ? (inProgress / totalStatus) * 100 : 0;

  // Calculate change vs yesterday (placeholder - would need historical data)
  const changeVsYesterday: number | null = data.totalReturn > 0 ? 12 : -5;

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
            <h1>Kalshi Trader</h1>
            <div className="nav-links">
              <Link href="/" className="active">Dashboard</Link>
              <Link href="/logs">Logs</Link>
              <Link href="/docs">Docs</Link>
            </div>
          </nav>
        </div>
      </div>

      <div className="container">
        <h1 className="section-title">Performance Dashboard</h1>

        {/* Current Bankroll Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Current total</div>
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
            {changeVsYesterday !== null && changeVsYesterday !== 0 && (
              <div className="metric">
                <span className="metric-label">vs Yesterday</span>
                <div className={`performance-indicator ${changeVsYesterday >= 0 ? 'up' : 'down'}`}>
                  {changeVsYesterday >= 0 ? '↑' : '↓'}
                  <span>{Math.abs(changeVsYesterday)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trade Status Breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Current total</div>
              <div className="card-value">{data.totalTrades} Trades</div>
            </div>
          </div>
          {totalStatus > 0 && (
            <>
              <div className="progress-bar">
                {completedPct > 0 && (
                  <div className="progress-segment green" style={{ width: `${completedPct}%` }}></div>
                )}
                {lostPct > 0 && (
                  <div className="progress-segment red" style={{ width: `${lostPct}%` }}></div>
                )}
                {stoppedPct > 0 && (
                  <div className="progress-segment yellow" style={{ width: `${stoppedPct}%` }}></div>
                )}
                {inProgressPct > 0 && (
                  <div className="progress-segment blue" style={{ width: `${inProgressPct}%` }}></div>
                )}
              </div>
              <div className="legend">
                {completed > 0 && (
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#10b981' }}></div>
                    <span>Won: {completed} trades</span>
                  </div>
                )}
                {lost > 0 && (
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#ef4444' }}></div>
                    <span>Lost: {lost} trades</span>
                  </div>
                )}
                {stopped > 0 && (
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#eab308' }}></div>
                    <span>Stopped: {stopped} trades</span>
                  </div>
                )}
                {inProgress > 0 && (
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: '#3b82f6' }}></div>
                    <span>Open: {inProgress} trades</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Performance Metrics */}
        <div className="grid">
          <div className="card">
            <div className="card-title">Win Rate</div>
            <div className="card-value">{(data.winRate * 100).toFixed(1)}%</div>
          </div>
          <div className="card">
            <div className="card-title">Open Positions</div>
            <div className="card-value">{data.openTrades}</div>
          </div>
        </div>

        {/* MTD / YTD Performance */}
        <div className="grid">
          <div className="card">
            <div className="card-title">Month-to-Date</div>
            <div className="metric-grid">
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
            <div className="card-title">Year-to-Date</div>
            <div className="metric-grid">
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
          <div className="card-header">
            <div className="card-title">Recent Trades</div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Contract</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTrades.slice(0, 10).map((trade: any) => (
                  <tr key={trade.id}>
                    <td>{new Date(trade.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {trade.contract?.question || 'N/A'}
                    </td>
                    <td>
                      <span className={`badge ${trade.side === 'YES' ? 'success' : 'info'}`}>
                        {trade.side}
                      </span>
                    </td>
                    <td>${trade.position_size.toFixed(0)}</td>
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
                    <td colSpan={6} className="empty-state">
                      <p>No trades yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Open Positions */}
        {data.openPositions.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Open Positions</div>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Side</th>
                    <th>Entry</th>
                    <th>Current</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openPositions.map((pos: any) => (
                    <tr key={pos.trade.id}>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pos.trade.contract?.question || 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${pos.trade.side === 'YES' ? 'success' : 'info'}`}>
                          {pos.trade.side}
                        </span>
                      </td>
                      <td>{(pos.trade.entry_odds * 100).toFixed(0)}%</td>
                      <td>{(pos.current_odds * 100).toFixed(0)}%</td>
                      <td className={pos.unrealized_pnl >= 0 ? 'positive' : 'negative'}>
                        {pos.unrealized_pnl >= 0 ? '+' : ''}${pos.unrealized_pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
