'use client';

import { useEffect, useState } from 'react';

interface Variable {
  id: string;
  key: string;
  category: string;
  label: string;
  description: string | null;
  value: number | null;
  previousValue: number | null;
  unit: string | null;
  status: string;
  trend: string | null;
  source: string | null;
  sourceUrl: string | null;
  lastUpdated: string;
}

interface Company {
  id: string;
  ticker: string | null;
  name: string;
  category: string;
  currentPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  revenueMultiple: number | null;
  priceChange1d: number | null;
  priceChange7d: number | null;
  priceChange30d: number | null;
  lastUpdated: string;
}

interface Suspicion {
  id: string;
  title: string;
  description: string;
  severity: string;
  variables: string[];
  historicalRef: string | null;
  detectedAt: string;
}

interface Snapshot {
  bubbleScore: number;
  compositeStatus: string;
  snapshotAt: string;
  notes: string | null;
}

interface WatchBoardClientProps {
  variables: Variable[];
  companies: Company[];
  suspicions: Suspicion[];
  snapshot: Snapshot | null;
}

export default function WatchBoardClient({ variables, companies, suspicions, snapshot }: WatchBoardClientProps) {
  const [initializing, setInitializing] = useState(true);

  // JARVIS initialization sequence
  useEffect(() => {
    const sequence = setTimeout(() => {
      setInitializing(false);
    }, 2800); // 2.8 seconds startup animation

    return () => clearTimeout(sequence);
  }, []);

  // Category summaries
  const categorySummary = (cat: string) => {
    const catVars = variables.filter(v => v.category === cat);
    const redCount = catVars.filter(v => v.status === 'red').length;
    const yellowCount = catVars.filter(v => v.status === 'yellow').length;
    const greenCount = catVars.filter(v => v.status === 'green').length;

    let status = 'green';
    if (redCount > 0) status = 'red';
    else if (yellowCount > 0) status = 'yellow';

    return { count: catVars.length, status };
  };

  const categoryNames: Record<string, string> = {
    valuation: 'VALUATION',
    investment_flow: 'INVESTMENT FLOW',
    infrastructure: 'INFRASTRUCTURE',
    adoption: 'ADOPTION',
    regulatory: 'REGULATORY',
    dot_com_lessons: 'DOT-COM LESSONS',
    telecom_lessons: 'TELECOM LESSONS'
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'red': return '#FF2D55';
      case 'yellow': return '#FFB700';
      case 'green': return '#00D4FF';
      default: return '#00D4FF';
    }
  };

  const trendIcon = (trend: string | null) => {
    if (!trend) return '—';
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '—';
  };

  if (initializing) {
    return (
      <div className="jarvis-container">
        <div className="jarvis-init">
          <div className="jarvis-logo">J.A.R.V.I.S.</div>
          <div className="jarvis-init-text">INITIALIZING...</div>
          <div className="jarvis-scan-line"></div>
        </div>
        <style jsx>{`
          .jarvis-container {
            min-height: 100vh;
            background: #000308;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Courier New', monospace;
          }
          .jarvis-init {
            text-align: center;
          }
          .jarvis-logo {
            font-size: 3rem;
            color: #00D4FF;
            font-weight: bold;
            letter-spacing: 0.3rem;
            text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
            margin-bottom: 2rem;
            animation: glow 2s ease-in-out infinite;
          }
          .jarvis-init-text {
            font-size: 1.2rem;
            color: #00D4FF;
            letter-spacing: 0.2rem;
            animation: pulse 1.5s ease-in-out infinite;
          }
          .jarvis-scan-line {
            width: 300px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #00D4FF, transparent);
            margin: 2rem auto 0;
            animation: scan 2s linear infinite;
          }
          @keyframes glow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          @keyframes scan {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="watchboard-container">
        {/* Header */}
        <div className="watchboard-header">
          <div className="header-title">AI WATCHBOARD</div>
          <div className="header-subtitle">MARKET STABILITY MONITOR</div>
        </div>

        {/* Bubble Score Gauge */}
        {snapshot && (
          <div className="bubble-score-panel panel">
            <div className="panel-title">BUBBLE RISK ASSESSMENT</div>
            <div className="bubble-gauge">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" fill="none" stroke="#0A1628" strokeWidth="20" />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke={statusColor(snapshot.compositeStatus)}
                  strokeWidth="20"
                  strokeDasharray={`${(snapshot.bubbleScore / 10) * 502.65} 502.65`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  style={{ filter: `drop-shadow(0 0 10px ${statusColor(snapshot.compositeStatus)})` }}
                />
              </svg>
              <div className="bubble-score-value" style={{ color: statusColor(snapshot.compositeStatus) }}>
                {snapshot.bubbleScore.toFixed(1)}
              </div>
              <div className="bubble-score-label">/ 10</div>
            </div>
            <div className="bubble-status" style={{ color: statusColor(snapshot.compositeStatus) }}>
              {snapshot.compositeStatus.toUpperCase()}
            </div>
            <div className="bubble-timestamp">
              LAST ANALYSIS: {new Date(snapshot.snapshotAt).toLocaleString('en-US', { 
                dateStyle: 'medium', 
                timeStyle: 'short' 
              })}
            </div>
          </div>
        )}

        {/* Category Status Panels */}
        <div className="category-grid">
          {['valuation', 'investment_flow', 'infrastructure', 'adoption', 'regulatory', 'dot_com_lessons', 'telecom_lessons'].map(cat => {
            const summary = categorySummary(cat);
            return (
              <div key={cat} className="category-panel panel">
                <div className="category-name">{categoryNames[cat]}</div>
                <div className="category-count">{summary.count} variables</div>
                <div 
                  className="category-status-dot"
                  style={{ 
                    backgroundColor: statusColor(summary.status),
                    boxShadow: `0 0 15px ${statusColor(summary.status)}`
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Variable Grid */}
        <div className="variables-section">
          <div className="section-title">MARKET VARIABLES</div>
          
          {/* Group variables by category */}
          {['valuation', 'investment_flow', 'infrastructure', 'adoption', 'regulatory', 'dot_com_lessons', 'telecom_lessons'].map(cat => {
            const catVars = variables.filter(v => v.category === cat);
            if (catVars.length === 0) return null;
            
            return (
              <div key={cat} className="category-section">
                <div className="category-section-header">{categoryNames[cat]}</div>
                
                {/* Historical context banners */}
                {cat === 'dot_com_lessons' && (
                  <div className="historical-banner dot-com-banner">
                    ⚠️ DERIVED FROM DOT-COM COLLAPSE ANALYSIS (1999–2002) — These variables track the same market dynamics that preceded the dot-com crash
                  </div>
                )}
                {cat === 'telecom_lessons' && (
                  <div className="historical-banner telecom-banner">
                    ⚠️ DERIVED FROM TELECOM BUBBLE ANALYSIS (2000–2002) — These variables mirror the infrastructure over-build dynamics that preceded the telecom collapse
                  </div>
                )}
                
                <div className="variables-grid">
                  {catVars.map(v => {
                    // Extract threshold legend and watching text from description
                    const thresholdMatch = v.description?.match(/🟢[^|]+\|[^|]+\|[^|]+/);
                    const watchingMatch = v.description?.match(/WATCHING FOR: ([^.]+\.?)/);
                    const thresholdText = thresholdMatch ? thresholdMatch[0] : '';
                    const watchingText = watchingMatch ? watchingMatch[1] : '';
                    const watchingTruncated = watchingText.length > 80 ? watchingText.substring(0, 80) + '...' : watchingText;
                    
                    return (
                      <div key={v.id} className="variable-card panel">
                        <div className="variable-label">
                          {v.label}
                          {v.description && <span className="info-icon">ⓘ</span>}
                        </div>
                        <div className="variable-value-row">
                          <div 
                            className="variable-status-dot"
                            style={{ 
                              backgroundColor: statusColor(v.status),
                              boxShadow: `0 0 10px ${statusColor(v.status)}`
                            }}
                          />
                          <div className="variable-value">
                            {v.value !== null ? v.value.toFixed(1) : '—'}
                            <span className="variable-unit">{v.unit || ''}</span>
                          </div>
                          <div className="variable-trend">{trendIcon(v.trend)}</div>
                        </div>
                        
                        {/* Threshold legend - always visible */}
                        {thresholdText && (
                          <div className="threshold-legend">
                            {thresholdText}
                          </div>
                        )}
                        
                        {/* Watching for text - always visible */}
                        {watchingText && (
                          <div className="watching-text" title={watchingText}>
                            WATCHING FOR: {watchingTruncated}
                          </div>
                        )}
                        
                        <div className="variable-updated">
                          {new Date(v.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        {v.description && (
                          <div className="variable-tooltip">
                            {v.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Company Portfolio */}
        <div className="companies-section">
          <div className="section-title">AI COMPANY PORTFOLIO</div>
          <div className="companies-table-wrapper">
            <table className="companies-table">
              <thead>
                <tr>
                  <th>TICKER</th>
                  <th>COMPANY</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>MARKET CAP</th>
                  <th>30D CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <tr key={c.id}>
                    <td className="ticker-cell">{c.ticker || '—'}</td>
                    <td>{c.name}</td>
                    <td className="category-cell">{c.category.replace(/_/g, ' ').toUpperCase()}</td>
                    <td className="price-cell">
                      {c.currentPrice !== null ? `$${c.currentPrice.toFixed(2)}` : '—'}
                    </td>
                    <td className="marketcap-cell">
                      {c.marketCap !== null ? `$${c.marketCap.toFixed(1)}B` : '—'}
                    </td>
                    <td 
                      className="change-cell"
                      style={{ 
                        color: c.priceChange30d && c.priceChange30d > 0 ? '#00D4FF' : c.priceChange30d && c.priceChange30d < 0 ? '#FF2D55' : '#777'
                      }}
                    >
                      {c.priceChange30d !== null 
                        ? `${c.priceChange30d > 0 ? '+' : ''}${c.priceChange30d.toFixed(1)}%` 
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Suspicions */}
        <div className="suspicions-section">
          <div className="section-title">ACTIVE SUSPICIONS</div>
          {suspicions.length === 0 ? (
            <div className="no-suspicions panel">
              <div className="no-suspicions-text">NO ACTIVE SUSPICIONS — SYSTEM NOMINAL</div>
            </div>
          ) : (
            <div className="suspicions-grid">
              {suspicions.map(s => (
                <div key={s.id} className="suspicion-card panel alert-panel">
                  <div className="suspicion-severity" style={{ color: statusColor('red') }}>
                    {s.severity.toUpperCase()}
                  </div>
                  <div className="suspicion-title">{s.title}</div>
                  <div className="suspicion-description">{s.description}</div>
                  {s.historicalRef && (
                    <div className="suspicion-historical">
                      ECHOES: {s.historicalRef}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="watchboard-footer">
          <div>JARVIS v1.0</div>
          <div>
            LAST SCAN: {snapshot ? new Date(snapshot.snapshotAt).toLocaleString('en-US', { 
              dateStyle: 'short', 
              timeStyle: 'short' 
            }) : '—'}
          </div>
          <div>NEXT SCAN: [MANUAL]</div>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

        .watchboard-container {
          min-height: 100vh;
          background: #000308;
          color: #00D4FF;
          font-family: 'Orbitron', 'Courier New', monospace;
          padding: 2rem;
          position: relative;
          overflow-x: hidden;
        }

        .watchboard-container::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px),
            linear-gradient(0deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: gridPulse 4s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes gridPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }

        .watchboard-container > * {
          position: relative;
          z-index: 1;
        }

        .watchboard-header {
          text-align: center;
          margin-bottom: 3rem;
          animation: fadeIn 0.8s ease-in;
        }

        .header-title {
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: 0.5rem;
          text-shadow: 0 0 30px rgba(0, 212, 255, 0.8);
          margin-bottom: 0.5rem;
        }

        .header-subtitle {
          font-size: 1rem;
          letter-spacing: 0.3rem;
          color: #0AF;
          opacity: 0.7;
        }

        .panel {
          background: rgba(10, 22, 40, 0.6);
          border: 2px solid rgba(0, 212, 255, 0.3);
          border-radius: 8px;
          box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
          padding: 1.5rem;
          animation: panelFlicker 0.5s ease-in;
        }

        @keyframes panelFlicker {
          0% { opacity: 0; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .bubble-score-panel {
          max-width: 400px;
          margin: 0 auto 3rem;
          text-align: center;
        }

        .panel-title {
          font-size: 0.9rem;
          letter-spacing: 0.2rem;
          margin-bottom: 1.5rem;
          opacity: 0.8;
        }

        .bubble-gauge {
          position: relative;
          width: 200px;
          height: 200px;
          margin: 0 auto;
        }

        .bubble-score-value {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 3.5rem;
          font-weight: 900;
          text-shadow: 0 0 20px currentColor;
        }

        .bubble-score-label {
          position: absolute;
          top: 60%;
          left: 50%;
          transform: translate(-50%, 0);
          font-size: 1rem;
          opacity: 0.6;
        }

        .bubble-status {
          margin-top: 1rem;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.2rem;
        }

        .bubble-timestamp {
          margin-top: 0.5rem;
          font-size: 0.7rem;
          opacity: 0.5;
          letter-spacing: 0.1rem;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .category-panel {
          text-align: center;
          position: relative;
        }

        .category-name {
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.1rem;
          margin-bottom: 0.5rem;
        }

        .category-count {
          font-size: 0.75rem;
          opacity: 0.6;
          margin-bottom: 1rem;
        }

        .category-status-dot {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          margin: 0 auto;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: 0.3rem;
          margin-bottom: 1.5rem;
          text-align: center;
          text-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
        }

        .variables-section {
          margin-bottom: 3rem;
        }
        
        .category-section {
          margin-bottom: 3rem;
        }
        
        .category-section-header {
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: 0.2rem;
          margin-bottom: 1rem;
          color: #00D4FF;
          text-shadow: 0 0 10px rgba(0, 212, 255, 0.4);
        }
        
        .historical-banner {
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          border-radius: 6px;
          font-size: 0.75rem;
          line-height: 1.5;
          letter-spacing: 0.05rem;
          border: 2px solid;
        }
        
        .dot-com-banner {
          background: rgba(255, 191, 0, 0.1);
          border-color: rgba(255, 191, 0, 0.4);
          color: #FFD700;
          box-shadow: 0 0 15px rgba(255, 191, 0, 0.2);
        }
        
        .telecom-banner {
          background: rgba(138, 43, 226, 0.1);
          border-color: rgba(138, 43, 226, 0.4);
          color: #DA70D6;
          box-shadow: 0 0 15px rgba(138, 43, 226, 0.2);
        }

        .variables-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1rem;
        }

        .variable-card {
          padding: 1rem;
          position: relative;
        }

        .variable-label {
          font-size: 0.75rem;
          opacity: 0.7;
          margin-bottom: 0.5rem;
          min-height: 2.5rem;
          display: flex;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .info-icon {
          font-size: 0.7rem;
          opacity: 0.5;
          cursor: help;
        }

        .variable-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          background: rgba(0, 10, 20, 0.95);
          border: 1px solid rgba(0, 212, 255, 0.4);
          padding: 0.75rem;
          font-size: 0.7rem;
          line-height: 1.5;
          z-index: 100;
          border-radius: 4px;
          color: rgba(0, 212, 255, 0.8);
          font-family: 'Courier New', monospace;
          box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
        }

        .variable-card:hover .variable-tooltip {
          display: block;
        }

        .variable-value-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .variable-status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .variable-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-family: 'Courier New', monospace;
        }

        .variable-unit {
          font-size: 0.9rem;
          margin-left: 0.25rem;
          opacity: 0.7;
        }

        .variable-trend {
          font-size: 1.2rem;
          margin-left: auto;
        }

        .threshold-legend {
          font-size: 0.65rem;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
          opacity: 0.7;
          line-height: 1.3;
          color: rgba(0, 212, 255, 0.8);
        }
        
        .watching-text {
          font-size: 0.7rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.4;
          color: rgba(0, 212, 255, 0.75);
          font-style: italic;
        }
        
        .variable-updated {
          font-size: 0.65rem;
          opacity: 0.5;
        }

        .companies-section {
          margin-bottom: 3rem;
        }

        .companies-table-wrapper {
          overflow-x: auto;
        }

        .companies-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Courier New', monospace;
        }

        .companies-table th {
          text-align: left;
          padding: 1rem;
          border-bottom: 2px solid rgba(0, 212, 255, 0.3);
          font-size: 0.75rem;
          letter-spacing: 0.1rem;
          opacity: 0.7;
        }

        .companies-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(0, 212, 255, 0.1);
        }

        .companies-table tbody tr:hover {
          background: rgba(0, 212, 255, 0.05);
        }

        .ticker-cell {
          font-weight: 700;
          color: #0AF;
        }

        .category-cell {
          font-size: 0.7rem;
          opacity: 0.6;
        }

        .price-cell, .marketcap-cell {
          font-family: 'Courier New', monospace;
        }

        .change-cell {
          font-weight: 700;
        }

        .suspicions-section {
          margin-bottom: 3rem;
        }

        .no-suspicions {
          text-align: center;
          padding: 3rem;
        }

        .no-suspicions-text {
          color: #00D4FF;
          font-size: 1.2rem;
          letter-spacing: 0.2rem;
          text-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
        }

        .suspicions-grid {
          display: grid;
          gap: 1.5rem;
        }

        .alert-panel {
          border-color: rgba(255, 45, 85, 0.5);
          box-shadow: 0 0 20px rgba(255, 45, 85, 0.3);
        }

        .suspicion-severity {
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.2rem;
          margin-bottom: 0.5rem;
        }

        .suspicion-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }

        .suspicion-description {
          font-size: 0.9rem;
          line-height: 1.6;
          opacity: 0.8;
          margin-bottom: 1rem;
        }

        .suspicion-historical {
          font-size: 0.75rem;
          opacity: 0.6;
          font-style: italic;
        }

        .watchboard-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem 0;
          font-size: 0.7rem;
          opacity: 0.5;
          letter-spacing: 0.1rem;
        }

        @media (max-width: 768px) {
          .watchboard-footer {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .header-title {
            font-size: 2rem;
          }
          
          .variables-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
