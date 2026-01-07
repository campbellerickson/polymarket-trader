import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function DocsPage() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the documentation from public folder
    fetch('/docs/ARCHITECTURE.md')
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load docs:', err);
        setContent('# Documentation\n\nFailed to load documentation.');
        setLoading(false);
      });
  }, []);

  // Convert markdown to HTML (simple parser)
  const renderMarkdown = (text: string) => {
    // Simple markdown to HTML conversion
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="doc-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="doc-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="doc-h1">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre class="doc-code-block"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code class="doc-inline-code">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="doc-link">$1</a>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li class="doc-li">$1</li>')
      // Tables (basic)
      .replace(/\|(.*)\|/gim, (match: string, content: string) => {
        const cells = content.split('|').map((c: string) => c.trim()).filter((c: string) => c);
        if (cells.length > 0) {
          return '<tr>' + cells.map((c: string) => `<td class="doc-td">${c}</td>`).join('') + '</tr>';
        }
        return match;
      })
      // Paragraphs
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('<'))
      .map(p => {
        if (p.startsWith('<')) return p;
        return `<p class="doc-p">${p}</p>`;
      })
      .join('');

    return html;
  };

  return (
    <>
      <Head>
        <title>System Documentation - Kalshi Trader</title>
      </Head>
      <div className="header">
        <div className="container">
          <nav className="nav">
            <h1>Kalshi Trader</h1>
            <div className="nav-links">
              <Link href="/">Dashboard</Link>
              <Link href="/logs">Logs</Link>
              <Link href="/docs" className="active">Docs</Link>
            </div>
          </nav>
        </div>
      </div>

      <div className="docs-container">
        <div className="docs-header">
          <h1>System Documentation</h1>
          <p className="docs-subtitle">Complete architecture and technical documentation</p>
        </div>
        
        {loading ? (
          <div className="docs-loading">
            <p>Loading documentation...</p>
          </div>
        ) : (
          <div 
            className="docs-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      <style jsx>{`
        .docs-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
        }

        .docs-header {
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e0e0e0;
        }

        .docs-header h1 {
          font-size: 2.5rem;
          margin: 0 0 0.5rem 0;
          color: #1a1a1a;
        }

        .docs-subtitle {
          font-size: 1.1rem;
          color: #666;
          margin: 0;
        }

        .docs-loading {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .docs-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        :global(.doc-h1) {
          font-size: 2rem;
          margin-top: 2rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e0e0e0;
          color: #1a1a1a;
        }

        :global(.doc-h2) {
          font-size: 1.5rem;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #2a2a2a;
        }

        :global(.doc-h3) {
          font-size: 1.25rem;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #3a3a3a;
        }

        :global(.doc-p) {
          margin: 1rem 0;
          color: #444;
        }

        :global(.doc-code-block) {
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
        }

        :global(.doc-code-block code) {
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 0.9rem;
          color: #333;
          white-space: pre;
        }

        :global(.doc-inline-code) {
          background: #f0f0f0;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 0.9em;
          color: #c7254e;
        }

        :global(.doc-li) {
          margin: 0.5rem 0;
          margin-left: 1.5rem;
        }

        :global(.doc-link) {
          color: #0066cc;
          text-decoration: none;
        }

        :global(.doc-link:hover) {
          text-decoration: underline;
        }

        :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }

        :global(.doc-td) {
          padding: 0.75rem;
          border: 1px solid #ddd;
        }

        :global(table tr:first-child .doc-td) {
          background: #f5f5f5;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .docs-container {
            padding: 1rem;
          }

          .docs-content {
            padding: 1rem;
          }

          .docs-header h1 {
            font-size: 2rem;
          }
        }
      `}</style>
    </>
  );
}

