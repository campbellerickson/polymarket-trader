import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  error?: string;
  stack?: string;
  context?: any;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');

  useEffect(() => {
    fetch('/api/logs')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setLogs(data.logs || []);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'error') return log.level === 'error';
    if (filter === 'warning') return log.level === 'warning';
    return true;
  });

  return (
    <>
      <Head>
        <title>Error Logs - Kalshi Trader</title>
        <meta name="description" content="Error logs for Kalshi trading system" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="header">
        <div className="container">
          <nav className="nav">
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Kalshi Trader</h1>
            <Link href="/">Dashboard</Link>
            <Link href="/logs" className="active">Error Logs</Link>
          </nav>
        </div>
      </div>

      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem' }}>Error Logs</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setFilter('all')}
              className={`badge ${filter === 'all' ? 'info' : ''}`}
              style={{ cursor: 'pointer', border: 'none', padding: '0.5rem 1rem' }}
            >
              All
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`badge ${filter === 'error' ? 'danger' : ''}`}
              style={{ cursor: 'pointer', border: 'none', padding: '0.5rem 1rem' }}
            >
              Errors
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`badge ${filter === 'warning' ? 'warning' : ''}`}
              style={{ cursor: 'pointer', border: 'none', padding: '0.5rem 1rem' }}
            >
              Warnings
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading">
            <p>Loading logs...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <h3>Error loading logs</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="card">
            {filteredLogs.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                No logs found. Logs will appear here once error logging is implemented.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Level</th>
                    <th>Message</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${
                          log.level === 'error' ? 'danger' :
                          log.level === 'warning' ? 'warning' :
                          'info'
                        }`}>
                          {log.level}
                        </span>
                      </td>
                      <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.message}
                      </td>
                      <td>
                        {log.error && (
                          <details style={{ cursor: 'pointer' }}>
                            <summary style={{ color: '#60a5fa' }}>View Error</summary>
                            <pre style={{ 
                              marginTop: '0.5rem', 
                              padding: '0.5rem', 
                              background: '#0f172a', 
                              borderRadius: '4px',
                              overflow: 'auto',
                              fontSize: '0.75rem',
                              maxHeight: '200px'
                            }}>
                              {log.error}
                              {log.stack && '\n\n' + log.stack}
                            </pre>
                          </details>
                        )}
                        {log.context && (
                          <details style={{ cursor: 'pointer', marginTop: '0.5rem' }}>
                            <summary style={{ color: '#60a5fa' }}>View Context</summary>
                            <pre style={{ 
                              marginTop: '0.5rem', 
                              padding: '0.5rem', 
                              background: '#0f172a', 
                              borderRadius: '4px',
                              overflow: 'auto',
                              fontSize: '0.75rem',
                              maxHeight: '200px'
                            }}>
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}
