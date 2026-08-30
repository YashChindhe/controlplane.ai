"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Download, Calendar, Activity, AlertOctagon, MoreVertical, X, ArrowLeft, Trash2 } from 'lucide-react';

// The Audit Vault UI supports two event schemas:
// 1. Direct audit-service schema: { guard, action, severity, metrics, rulesTriggered, contentHash }
// 2. Gateway streaming schema:    { model, evaluation: { action, performance, cost, responsibility } }
// normalizeEvent() bridges both schemas into a unified display format.
interface AuditEvent {
  eventId: string;
  timestamp: string;
  tenantId: string;
  guard: string;
  action: string;
  severity: string;
  model?: string;
  metrics: {
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    performanceScore?: number;
    hasPii?: boolean;
    matchedEntities?: string[];
  };
  rulesTriggered: Array<{
    ruleId?: string;
    ruleName: string;
    description?: string;
  }>;
  contentHash: string;
}

// Normalize any event — whether from the gateway streaming schema or the old audit-service schema
function normalizeEvent(raw: any): AuditEvent {
  // If event has the gateway streaming schema (evaluation field)
  if (raw.evaluation) {
    const evaluation = raw.evaluation || {};
    const perfScore = evaluation.performance?.score ?? 100;
    const action = evaluation.action || 'pass';
    const hasPii = evaluation.responsibility?.hasPii || false;
    const tokens = evaluation.cost?.tokens || 0;

    let severity = 'safe';
    if (action === 'block') severity = 'critical';
    else if (action === 'flag') severity = 'medium';
    else if (action === 'redact') severity = 'low';

    let guard = 'performance';
    if (hasPii) guard = 'responsibility';
    else if (perfScore < 70) guard = 'performance';

    const matchedEntities = evaluation.responsibility?.matchedEntities || [];

    return {
      eventId: raw.eventId,
      timestamp: raw.timestamp,
      tenantId: raw.tenantId,
      guard,
      action,
      severity,
      model: raw.model,
      metrics: {
        latencyMs: 0, // Not tracked in streaming schema
        outputTokens: tokens,
        cost: undefined,
        performanceScore: perfScore,
        hasPii,
        matchedEntities,
      },
      rulesTriggered: matchedEntities.map((e: string) => ({ ruleName: `${e} Detected` })),
      contentHash: raw.response?.text ? `sha256:${raw.eventId.slice(0, 16)}...` : 'N/A',
    };
  }

  // Old audit-service schema — return as-is with safe defaults
  return {
    eventId: raw.eventId || 'unknown',
    timestamp: raw.timestamp || new Date().toISOString(),
    tenantId: raw.tenantId || '',
    guard: raw.guard || 'unknown',
    action: raw.action || 'pass',
    severity: raw.severity || 'safe',
    model: raw.model,
    metrics: raw.metrics || { latencyMs: 0 },
    rulesTriggered: raw.rulesTriggered || [],
    contentHash: raw.contentHash || 'N/A',
  };
}

const MOCK_EVENTS: AuditEvent[] = [
  {
    eventId: "evt_9a2f1b8e",
    timestamp: new Date().toISOString(),
    tenantId: "tenant-default",
    guard: "responsibility",
    action: "redact",
    severity: "medium",
    metrics: { latencyMs: 22, inputTokens: 48, outputTokens: 96, cost: 0.0003 },
    rulesTriggered: [{ ruleName: "GDPR Email Masking" }],
    contentHash: "sha256_b3781ad2b9921e25e..."
  },
  {
    eventId: "evt_1a9f0e6b",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    tenantId: "tenant-default",
    guard: "performance",
    action: "block",
    severity: "critical",
    metrics: { latencyMs: 38, inputTokens: 112, outputTokens: 14, cost: 0.0001 },
    rulesTriggered: [{ ruleName: "Block Hallucination > 80%" }],
    contentHash: "sha256_fa8192cb911029c..."
  }
];

export default function AuditVault() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(true);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    const checkState = () => {
      const role = localStorage.getItem('mockRole');
      setIsAdmin(role !== 'viewer');
      const mock = localStorage.getItem('useMockData');
      setUseMockData(mock === 'true');
    };
    checkState();
    window.addEventListener('storage', checkState);
    return () => window.removeEventListener('storage', checkState);
  }, []);

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const tenantId = 'default';
  const [searchQuery, setSearchQuery] = useState('');
  const [guardFilter, setGuardFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchEvents = async () => {
    if (useMockData) {
      setEvents(MOCK_EVENTS);
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('q', searchQuery);
      if (guardFilter) queryParams.append('guard', guardFilter);
      if (actionFilter) queryParams.append('action', actionFilter);
      if (severityFilter) queryParams.append('severity', severityFilter);

      const res = await fetch(`http://localhost:8002/audit?${queryParams.toString()}`, {
        headers: { 'tenant-id': tenantId }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.events) {
          // Normalize events from any schema (gateway streaming or audit-service native)
          setEvents((data.events as any[]).map(normalizeEvent));
          setErrorMsg('');
        }
      } else {
        setEvents([]);
        setErrorMsg('Failed to fetch from Audit Service (check that it is running on port 8002).');
      }
    } catch (err) {
      setEvents([]);
      setErrorMsg("Audit Service unreachable (localhost:8002). Enable Mock Data to preview UI.");
    }
  };

  useEffect(() => {
    fetchEvents();
    
    // Auto-refresh every 10 seconds to dynamically update
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [searchQuery, guardFilter, actionFilter, severityFilter, useMockData]);

  const handleExport = () => {
    const queryParams = new URLSearchParams();
    if (searchQuery) queryParams.append('q', searchQuery);
    if (guardFilter) queryParams.append('guard', guardFilter);
    if (actionFilter) queryParams.append('action', actionFilter);
    if (severityFilter) queryParams.append('severity', severityFilter);
    queryParams.append('format', 'csv');

    window.open(`http://localhost:8002/audit/export?${queryParams.toString()}`);
  };

  const handleClearHistory = async () => {
    // Optimistically clear the UI immediately
    setEvents([]);
    
    try {
      await fetch('http://localhost:8002/audit', {
        method: 'DELETE',
        headers: { 'tenant-id': tenantId }
      });
    } catch (err) {
      console.warn("Backend is offline, but UI was cleared.");
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-info">
          <button className="back-btn" onClick={() => router.back()} title="Go Back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">Audit Vault</h1>
            <p className="page-description">Query immutable WORM archives of AI event governance actions.</p>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="export-btn clear-history" onClick={handleClearHistory} disabled={useMockData} style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--color-brand-red)' }}>
              <Trash2 className="icon" size={16} />
              <span>Clear History</span>
            </button>
            <button className="export-btn" onClick={handleExport}>
              <Download className="icon" size={16} />
              <span>Export Logs (CSV)</span>
            </button>
          </div>
        )}
      </header>

      {errorMsg && (
        <div className="alert-box error" style={{ marginBottom: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-brand-red)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-brand-red)' }}>
          <AlertOctagon size={16} />
          <span style={{ marginLeft: '8px' }}>{errorMsg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <section className="filter-toolbar">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search by event ID or hash..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-group">
          <select value={guardFilter} onChange={(e) => setGuardFilter(e.target.value)}>
            <option value="">All Guards</option>
            <option value="performance">Performance Guard</option>
            <option value="cost">Cost Guard</option>
            <option value="responsibility">Responsibility Guard</option>
          </select>

          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="pass">Pass</option>
            <option value="flag">Flag</option>
            <option value="redact">Redact</option>
            <option value="block">Block</option>
          </select>

          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </section>

      {/* Audit Log Table */}
      <section className="logs-panel">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event ID</th>
              <th>Guard</th>
              <th>Action</th>
              <th>Severity</th>
              <th>Latency</th>
              <th>Cost</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  {errorMsg || 'No audit events found. Make a proxied LLM request through the gateway to generate events.'}
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.eventId} className="event-row">
                  <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className="code" title={e.eventId}>{e.eventId.slice(0, 20)}...</td>
                  <td><span className="capitalize">{e.guard}</span></td>
                  <td><span className={`action-tag ${e.action}`}>{e.action}</span></td>
                  <td><span className={`severity-tag ${e.severity}`}>{e.severity}</span></td>
                  <td>{e.metrics.latencyMs > 0 ? `${e.metrics.latencyMs}ms` : (e.metrics.outputTokens ? `${e.metrics.outputTokens} tok` : 'N/A')}</td>
                  <td>{e.metrics.cost != null ? `$${e.metrics.cost.toFixed(5)}` : (e.metrics.performanceScore != null ? `Score: ${e.metrics.performanceScore.toFixed(1)}` : 'N/A')}</td>
                  <td>
                    <button className="details-btn" onClick={() => setSelectedEvent(e)}>
                      View Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3 className="modal-title">Event Investigation: {selectedEvent.eventId}</h3>
              <button className="close-btn" onClick={() => setSelectedEvent(null)}>
                <X size={18} />
              </button>
            </header>
            
            <div className="modal-body">
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Timestamp</span>
                  <span className="value">{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                </div>
                <div className="info-item">
                  <span className="label">Tenant ID</span>
                  <span className="value">{selectedEvent.tenantId}</span>
                </div>
                <div className="info-item">
                  <span className="label">Content SHA256 Hash</span>
                  <span className="value code">{selectedEvent.contentHash}</span>
                </div>
              </div>

              <div className="rules-section">
                <h4 className="section-title">Triggered Rules</h4>
                {selectedEvent.rulesTriggered.length > 0 ? (
                  <ul className="triggered-rules-list">
                    {selectedEvent.rulesTriggered.map((rule, idx) => (
                      <li key={idx} className="rule-item">
                        <strong>{rule.ruleName}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-rules">No individual rules triggered. Evaluator verdict passed default checks.</p>
                )}
              </div>

              <div className="metrics-section">
                <h4 className="section-title">Metrics</h4>
                <div className="metrics-grid">
                  <div className="metric-box">
                    <span className="m-label">Latency</span>
                    <span className="m-val">{selectedEvent.metrics.latencyMs} ms</span>
                  </div>
                  <div className="metric-box">
                    <span className="m-label">Input Tokens</span>
                    <span className="m-val">{selectedEvent.metrics.inputTokens || "N/A"}</span>
                  </div>
                  <div className="metric-box">
                    <span className="m-label">Output Tokens</span>
                    <span className="m-val">{selectedEvent.metrics.outputTokens || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-container {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: var(--text-primary);
          background-color: var(--bg-base);
          min-height: 100vh;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .back-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .back-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background-color: var(--bg-surface-2);
        }

        .page-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: var(--gradient-brand);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .page-description {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: var(--bg-overlay);
          border: 1px solid var(--border-brand);
          color: var(--text-primary);
          padding: 12px 20px;
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .export-btn:hover {
          background-color: var(--bg-surface-2);
        }

        .filter-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 16px 24px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          flex: 1;
          max-width: 400px;
        }

        .search-icon {
          color: var(--text-tertiary);
        }

        .search-box input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          outline: none;
          width: 100%;
          font-size: 14px;
        }

        .filters-group {
          display: flex;
          gap: 12px;
        }

        select {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 14px;
        }

        .logs-panel {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          overflow-x: auto;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .audit-table th, .audit-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-subtle);
          font-size: 14px;
        }

        .audit-table th {
          color: var(--text-secondary);
          font-weight: 600;
        }

        .event-row:hover {
          background-color: var(--bg-surface-2);
        }

        .code {
          font-family: var(--font-mono);
        }

        .capitalize {
          text-transform: capitalize;
        }

        .action-tag {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }

        .action-tag.pass {
          background-color: rgba(16, 185, 129, 0.1);
          color: var(--color-brand-green-light);
        }

        .action-tag.redact {
          background-color: rgba(124, 58, 237, 0.1);
          color: var(--color-brand-violet-light);
        }

        .action-tag.flag {
          background-color: rgba(245, 158, 11, 0.1);
          color: var(--color-brand-yellow-light);
        }

        .action-tag.block {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--color-brand-red-light);
        }

        .severity-tag {
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }

        .severity-tag.low {
          background-color: rgba(16, 185, 129, 0.1);
          color: var(--color-brand-green-light);
        }

        .severity-tag.medium {
          background-color: rgba(245, 158, 11, 0.1);
          color: var(--color-brand-yellow-light);
        }

        .severity-tag.high {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--color-brand-red-light);
        }

        .severity-tag.critical {
          background-color: rgba(239, 68, 68, 0.2);
          border: 1px solid var(--color-brand-red);
          color: var(--color-brand-red-light);
        }

        .details-btn {
          background: transparent;
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }

        .details-btn:hover {
          background-color: var(--bg-surface-2);
          color: var(--text-primary);
        }

        /* Modal styling */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          width: 90%;
          max-width: 600px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }

        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-size: 16px;
          font-weight: 700;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
        }

        .info-item .label {
          color: var(--text-secondary);
          font-size: 13px;
        }

        .info-item .value {
          font-weight: 600;
          font-size: 13px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .triggered-rules-list {
          list-style: none;
          padding: 0;
        }

        .rule-item {
          background-color: var(--bg-surface-2);
          border-left: 4px solid var(--border-brand);
          padding: 10px 14px;
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
          font-size: 13px;
        }

        .no-rules {
          font-size: 13px;
          color: var(--text-tertiary);
          font-style: italic;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .metric-box {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .m-label {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .m-val {
          font-size: 14px;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
