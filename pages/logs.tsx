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
            <h1>Kalshi Trader</h1>
            <div className="nav-links">
              <Link href="/">Dashboard</Link>
              <Link href="/logs" className="active">Logs</Link>
              <Link href="/docs">Docs</Link>
            </div>
          </nav>
        </div>
      </div>

      <div className="container">
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <h1 className="section-title">Error Logs</h1>
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setFilter('all')}
              className={`badge ${filter === 'all' ? 'info' : ''}`}
              style={{ 
                cursor: 'pointer', 
                border: 'none', 
                padding: '0.5rem 1rem',
                background: filter === 'all' ? '#dbeafe' : '#f1f5f9',
                color: filter === 'all' ? '#1e40af' : '#475569'
              }}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`badge ${filter === 'error' ? 'danger' : ''}`}
              style={{ 
                cursor: 'pointer', 
                border: 'none', 
                padding: '0.5rem 1rem',
                background: filter === 'error' ? '#fee2e2' : '#f1f5f9',
                color: filter === 'error' ? '#991b1b' : '#475569'
              }}
            >
              Errors ({logs.filter(l => l.level === 'error').length})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`badge ${filter === 'warning' ? 'warning' : ''}`}
              style={{ 
                cursor: 'pointer', 
                border: 'none', 
                padding: '0.5rem 1rem',
                background: filter === 'warning' ? '#fef3c7' : '#f1f5f9',
                color: filter === 'warning' ? '#92400e' : '#475569'
              }}
            >
              Warnings ({logs.filter(l => l.level === 'warning').length})
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading logs...</p>
          </div>
        )}

        {error && (
          <div className="error">
            <h2>Error loading logs</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="card">
            {filteredLogs.length === 0 ? (
              <div className="empty-state">
                <p>No {filter === 'all' ? '' : filter} logs found.</p>
                <p>Logs will appear here once errors occur.</p>
              </div>
            ) : (
              <div className="table-wrapper">
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
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                          {new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
                        <td style={{ 
                          maxWidth: '300px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {log.message}
                        </td>
                        <td>
                          {log.error && (
                            <details style={{ cursor: 'pointer' }}>
                              <summary style={{ 
                                color: '#3b82f6',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}>
                                View Error
                              </summary>
                              <pre style={{ 
                                marginTop: '0.5rem', 
                                padding: '1rem', 
                                background: '#f8fafc', 
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                overflow: 'auto',
                                fontSize: '0.75rem',
                                maxHeight: '200px',
                                color: '#1e293b'
                              }}>
                                {log.error}
                                {log.stack && '\n\n' + log.stack}
                              </pre>
                            </details>
                          )}
                          {log.context && (
                            <details style={{ cursor: 'pointer', marginTop: log.error ? '0.5rem' : 0 }}>
                              <summary style={{ 
                                color: '#3b82f6',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}>
                                View Context
                              </summary>
                              <pre style={{ 
                                marginTop: '0.5rem', 
                                padding: '1rem', 
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                overflow: 'auto',
                                fontSize: '0.75rem',
                                maxHeight: '200px',
                                color: '#1e293b'
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
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
