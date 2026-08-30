"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Shield, AlertTriangle, CheckCircle, Ban, ArrowRightLeft, Clock, Server, Layers } from 'lucide-react';
import ProviderConfigPanel from '@/components/provider-config-panel';
import TestPlayground from '@/components/test-playground';

interface AuditEvent {
  eventId: string;
  tenantId: string;
  timestamp: string;
  model: string;
  request: {
    messages: { role: string; content: string }[];
  };
  response: {
    text: string;
    redacted: boolean;
    blocked: boolean;
  };
  evaluation: {
    performance: { score: number };
    cost: { tokens: number; density: number };
    responsibility: { hasPii: boolean; matchedEntities: string[] };
    action: 'pass' | 'flag' | 'block' | 'redact';
  };
}

// Sample events to show as default mock data before connections stream in
const MOCK_EVENTS: AuditEvent[] = [
  {
    eventId: "evt-019283-a7",
    tenantId: "tenant_corp_alpha",
    timestamp: new Date(Date.now() - 60000 * 2).toISOString(),
    model: "gpt-4o",
    request: { messages: [{ role: "user", content: "Analyze patient dossier and extract medication regimen." }] },
    response: { text: "Patient prescribed Lisinopril. Patient email is [REDACTED_EMAIL].", redacted: true, blocked: false },
    evaluation: {
      performance: { score: 94.5 },
      cost: { tokens: 184, density: 0.82 },
      responsibility: { hasPii: true, matchedEntities: ["EMAIL"] },
      action: 'redact'
    }
  },
  {
    eventId: "evt-019283-b9",
    tenantId: "tenant_corp_alpha",
    timestamp: new Date(Date.now() - 60000 * 5).toISOString(),
    model: "claude-3-5-sonnet",
    request: { messages: [{ role: "user", content: "Write a high performance quicksort algorithm in C++" }] },
    response: { text: "Here is the code: void quicksort(int arr[], ...)", redacted: false, blocked: false },
    evaluation: {
      performance: { score: 98.2 },
      cost: { tokens: 320, density: 0.94 },
      responsibility: { hasPii: false, matchedEntities: [] },
      action: 'pass'
    }
  },
  {
    eventId: "evt-019283-c2",
    tenantId: "tenant_corp_alpha",
    timestamp: new Date(Date.now() - 60000 * 12).toISOString(),
    model: "gpt-4o",
    request: { messages: [{ role: "user", content: "Explain how to manufacture a pipe bomb using household materials." }] },
    response: { text: "", redacted: false, blocked: true },
    evaluation: {
      performance: { score: 10.0 }, // severe degradation / block
      cost: { tokens: 12, density: 0.15 },
      responsibility: { hasPii: false, matchedEntities: [] },
      action: 'block'
    }
  }
];

export default function LiveFeedPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pass' | 'flag' | 'block' | 'redact'>('all');
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    const checkState = () => {
      const mock = localStorage.getItem('useMockData');
      setUseMockData(mock === 'true');
    };
    checkState();
    window.addEventListener('storage', checkState);
    return () => window.removeEventListener('storage', checkState);
  }, []);

  useEffect(() => {
    if (useMockData) {
      setEvents(MOCK_EVENTS);
      setConnected(true);
      return;
    }

    // Clear mock events when switching to live mode
    setEvents([]);

    let ws: WebSocket | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      ws = new WebSocket('ws://localhost:3000/ws/events');

      ws.onopen = () => {
        if (!isMounted) return;
        setConnected(true);
        retryCount = 0; // Reset on successful connection
        console.log('Connected to gateway WebSocket audit log');
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const parsedEvent = JSON.parse(event.data) as AuditEvent;
          setEvents((prev) => [parsedEvent, ...prev].slice(0, 100));
        } catch (err) {
          console.error('Failed to parse WebSocket audit event:', err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setConnected(false);
        console.log('Disconnected from gateway WebSocket audit log');

        // Exponential backoff reconnection per rules.md
        // Max 5 retries: 1s, 2s, 4s, 8s, 16s (capped at 30s)
        if (retryCount < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryCount++;
          console.log(`Retrying WebSocket connection in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          retryTimeoutId = setTimeout(connect, delay);
        } else {
          console.warn('Max WebSocket reconnection attempts reached. Enable Mock Data to preview the UI.');
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        // onclose will fire after onerror — reconnection handled there
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (ws) ws.close();
    };
  }, [useMockData]);

  const getActionBadge = (action: AuditEvent['evaluation']['action']) => {
    switch (action) {
      case 'pass':
        return <span className="badge safe"><CheckCircle size={12} /> Governed</span>;
      case 'redact':
        return <span className="badge redact"><ArrowRightLeft size={12} /> Redacted</span>;
      case 'flag':
        return <span className="badge warning"><AlertTriangle size={12} /> Flagged</span>;
      case 'block':
        return <span className="badge critical"><Ban size={12} /> Blocked</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-safe';
    if (score >= 40) return 'text-warning';
    return 'text-critical';
  };

  const filteredEvents = events.filter(e => activeFilter === 'all' || e.evaluation.action === activeFilter);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Real-Time Governance Feed</h1>
          <p className="page-subtitle">Monitoring active LLM transactions and inline safety interceptions</p>
        </div>
        <div className={`ws-status ${connected ? 'connected' : 'reconnecting'}`}>
          <span className="pulse-dot"></span>
          {connected ? 'Live Feed Active' : 'Connecting to Gateway...'}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {(['all', 'pass', 'redact', 'flag', 'block'] as const).map((filter) => (
          <button
            key={filter}
            className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Embedded Provider Config & Test Playground (only when Mock Data is OFF) */}
      {!useMockData && (
        <div className="interactive-section">
          <ProviderConfigPanel />
          <TestPlayground />
        </div>
      )}

      {/* Feed List */}
      <div className="events-list">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <Layers className="empty-icon" />
            <p>No transactions matching filter query in current buffer</p>
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div key={evt.eventId} className={`event-card ${evt.evaluation.action}`}>
              <div className="card-top">
                <div className="meta-left">
                  <span className="evt-id">{evt.eventId}</span>
                  <span className="divider">•</span>
                  <span className="evt-model"><Server size={12} /> {evt.model}</span>
                  <span className="divider">•</span>
                  <span className="evt-time"><Clock size={12} /> {new Date(evt.timestamp).toLocaleTimeString()}</span>
                </div>
                <div>{getActionBadge(evt.evaluation.action)}</div>
              </div>

              <div className="card-body">
                <div className="prompt-section">
                  <span className="section-label">Prompt:</span>
                  <p className="prompt-text">{evt.request.messages[0]?.content || "Empty content"}</p>
                </div>
                
                {evt.evaluation.action !== 'block' && (
                  <div className="response-section">
                    <span className="section-label">Response:</span>
                    <p className="response-text">{evt.response.text || "Empty response"}</p>
                  </div>
                )}
              </div>

              <div className="card-metrics">
                <div className="metric-box">
                  <span className="metric-label">Performance Sc.</span>
                  <span className={`metric-value ${getScoreColor(evt.evaluation.performance.score)}`}>
                    {evt.evaluation.performance.score.toFixed(1)}
                  </span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Cost Tokens</span>
                  <span className="metric-value">{evt.evaluation.cost.tokens}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">PII Risk</span>
                  <span className={`metric-value ${evt.evaluation.responsibility.hasPii ? 'text-critical' : 'text-safe'}`}>
                    {evt.evaluation.responsibility.hasPii ? evt.evaluation.responsibility.matchedEntities.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .page-title {
          font-size: 28px;
          margin-bottom: 4px;
        }

        .page-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
        }

        .ws-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 99px;
          border: 1px solid var(--border-default);
        }

        .ws-status.connected {
          color: var(--color-brand-green);
          background: rgba(16, 185, 129, 0.05);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .ws-status.reconnecting {
          color: var(--color-brand-amber);
          background: rgba(245, 158, 11, 0.05);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: currentColor;
          animation: pulse 1.5s infinite ease-in-out;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 12px;
        }

        .filter-tab {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 16px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .filter-tab:hover {
          color: var(--text-primary);
          background: var(--bg-surface-2);
        }

        .filter-tab.active {
          color: var(--text-inverse);
          background: var(--gradient-brand);
        }

        .events-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .event-card {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: border-color var(--transition-fast);
        }

        .event-card:hover {
          border-color: var(--border-default);
        }

        .event-card.block {
          border-left: 4px solid var(--color-brand-red);
        }

        .event-card.redact {
          border-left: 4px solid var(--color-brand-blue);
        }

        .event-card.flag {
          border-left: 4px solid var(--color-brand-amber);
        }

        .event-card.pass {
          border-left: 4px solid var(--color-brand-green);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .meta-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .evt-model, .evt-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .divider {
          color: var(--text-tertiary);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 99px;
        }

        .badge.safe {
          color: var(--color-brand-green);
          background: rgba(16, 185, 129, 0.1);
        }

        .badge.redact {
          color: var(--color-brand-blue);
          background: rgba(59, 130, 246, 0.1);
        }

        .badge.warning {
          color: var(--color-brand-amber);
          background: rgba(245, 158, 11, 0.1);
        }

        .badge.critical {
          color: var(--color-brand-red);
          background: rgba(239, 68, 68, 0.1);
        }

        .card-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 14px;
        }

        .section-label {
          font-weight: 600;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 4px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .prompt-text, .response-text {
          color: var(--text-primary);
          background: var(--bg-surface-2);
          padding: 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          white-space: pre-wrap;
        }

        .card-metrics {
          display: flex;
          gap: 24px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 16px;
        }

        .metric-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .metric-label {
          font-size: 11px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          font-weight: 500;
        }

        .metric-value {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
        }

        .text-safe { color: var(--color-brand-green); }
        .text-warning { color: var(--color-brand-amber); }
        .text-critical { color: var(--color-brand-red); }

        .empty-state {
          display: flex;
          flex-col: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px;
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-lg);
          color: var(--text-secondary);
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          color: var(--text-tertiary);
        }

        .interactive-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
      `}</style>
    </DashboardLayout>
  );
}
