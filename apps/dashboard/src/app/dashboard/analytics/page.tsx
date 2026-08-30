"use client";

import React from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { TrendingUp, DollarSign, Cpu, AlertTriangle, Trash2 } from 'lucide-react';

const MOCK_TIMELINE = [
  { time: '12:00', performance: 95, cost: 45, responsibility: 98 },
  { time: '13:00', performance: 92, cost: 55, responsibility: 99 },
  { time: '14:00', performance: 88, cost: 60, responsibility: 98 },
  { time: '15:00', performance: 94, cost: 40, responsibility: 80 },
  { time: '16:00', performance: 97, cost: 35, responsibility: 99 },
  { time: '17:00', performance: 91, cost: 70, responsibility: 95 },
  { time: '18:00', performance: 95, cost: 50, responsibility: 99 },
];

const MOCK_VOLUME = [
  { name: 'gpt-4o', safe: 400, flagged: 24, blocked: 4 },
  { name: 'claude-3-5-sonnet', safe: 300, flagged: 18, blocked: 2 },
  { name: 'gpt-3.5-turbo', safe: 580, flagged: 45, blocked: 12 },
  { name: 'llama-3-70b', safe: 180, flagged: 8, blocked: 1 },
];

export default function AnalyticsPage() {
  const [useMockData, setUseMockData] = React.useState(false);
  const tenantId = 'default';
  const [allRawEvents, setAllRawEvents] = React.useState<any[]>([]);
  
  // Filters
  const [timeFilter, setTimeFilter] = React.useState('all');
  const [modelFilter, setModelFilter] = React.useState('all');

  const [timelineData, setTimelineData] = React.useState<any[]>([]);
  const [volumeData, setVolumeData] = React.useState<any[]>([]);
  const [kpis, setKpis] = React.useState({ latency: 0, efficiency: 0, spend: 0, blocked: 0, totalEvents: 0 });

  React.useEffect(() => {
    const checkState = () => {
      const mock = localStorage.getItem('useMockData');
      setUseMockData(mock === 'true');
    };
    checkState();
    window.addEventListener('storage', checkState);
    return () => window.removeEventListener('storage', checkState);
  }, []);

  React.useEffect(() => {
    async function fetchLiveData() {
      if (useMockData) return; // handled by the other effect

      try {
        const res = await fetch('http://localhost:8002/audit', {
          headers: { 'tenant-id': tenantId }
        });
        if (res.ok) {
          const data = await res.json();
          setAllRawEvents(data.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    }
    fetchLiveData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchLiveData, 10000);
    return () => clearInterval(interval);
  }, [useMockData]);

  // Compute metrics based on filters
  React.useEffect(() => {
    if (useMockData) {
      setTimelineData(MOCK_TIMELINE);
      setVolumeData(MOCK_VOLUME);
      setKpis({ latency: 38, efficiency: 84.2, spend: 184.22, blocked: 19, totalEvents: 850 });
      return;
    }

    let filtered = [...allRawEvents];

    // Apply Time Filter
    const now = new Date().getTime();
    if (timeFilter !== 'all') {
      const hours = timeFilter === '1h' ? 1 : (timeFilter === '24h' ? 24 : 168); // 168 = 7d
      const cutoff = now - (hours * 60 * 60 * 1000);
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    }

    // Apply Model Filter
    if (modelFilter !== 'all') {
      filtered = filtered.filter(e => e.model === modelFilter);
    }

    if (filtered.length === 0) {
      setTimelineData([]);
      setVolumeData([]);
      setKpis({ latency: 0, efficiency: 0, spend: 0, blocked: 0, totalEvents: 0 });
      return;
    }

    // Compute KPIs
    let totalDensity = 0;
    let totalTokens = 0;
    let blockedCount = 0;
    
    filtered.forEach((e: any) => {
      const evalData = e.evaluation || {};
      totalDensity += evalData.cost?.density || 1;
      totalTokens += evalData.cost?.tokens || 0;
      if (evalData.action === 'block') blockedCount++;
    });

    const avgEfficiency = (totalDensity / filtered.length) * 100;
    const totalSpend = totalTokens * 0.00015; // Mock rate

    setKpis({ 
      latency: 42,
      efficiency: parseFloat(avgEfficiency.toFixed(1)), 
      spend: parseFloat(totalSpend.toFixed(4)), 
      blocked: blockedCount,
      totalEvents: filtered.length
    });

    // Compute Timeline Data (taking up to 15 recent events)
    const timeline = filtered.slice(-15).map((e: any) => {
      const evalData = e.evaluation || {};
      return {
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        performance: evalData.performance?.score || 100,
        cost: Math.min((evalData.cost?.tokens || 0) * 2, 100),
        responsibility: evalData.responsibility?.hasPii ? 40 : 100
      };
    });
    setTimelineData(timeline);

    // Compute Volume Data
    const modelMap: Record<string, any> = {};
    filtered.forEach((e: any) => {
      const model = e.model || 'unknown';
      const action = e.evaluation?.action || 'pass';
      if (!modelMap[model]) {
        modelMap[model] = { name: model, safe: 0, flagged: 0, blocked: 0 };
      }
      if (action === 'pass') modelMap[model].safe++;
      else if (action === 'block') modelMap[model].blocked++;
      else modelMap[model].flagged++;
    });
    setVolumeData(Object.values(modelMap));

  }, [useMockData, allRawEvents, timeFilter, modelFilter]);

  // Extract unique models for the dropdown
  const uniqueModels = React.useMemo(() => {
    const models = new Set<string>();
    allRawEvents.forEach(e => {
      if (e.model) models.add(e.model);
    });
    return Array.from(models);
  }, [allRawEvents]);

  const handleClearHistory = async () => {
    // Optimistically clear the UI immediately
    setAllRawEvents([]);
    
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
    <DashboardLayout>
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Operational Analytics</h1>
            <p className="page-subtitle">Historical performance and cost metrics for active endpoints</p>
          </div>
          
          {/* Context Badge */}
          <div className="context-badge">
            <span className="context-label">Analyzing:</span>
            <strong>{kpis.totalEvents} events</strong>
            <span className="context-detail">
              ({timeFilter === 'all' ? 'All Time' : timeFilter === '1h' ? 'Last Hour' : timeFilter === '24h' ? 'Last 24 Hours' : 'Last 7 Days'} • {modelFilter === 'all' ? 'All Models' : modelFilter})
            </span>
          </div>
        </div>

        {/* Filters UI */}
        <div className="filters-bar">
          <div className="filter-group-container">
            <div className="filter-group">
              <label>Timeframe</label>
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Model Endpoint</label>
              <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
                <option value="all">All Models</option>
                {uniqueModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="clear-btn" onClick={handleClearHistory} disabled={useMockData}>
            <Trash2 size={16} />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Average Latency</span>
            <Cpu className="kpi-icon violet" />
          </div>
          <div className="kpi-value font-mono">{kpis.latency}ms</div>
          {useMockData && <span className="kpi-trend positive"><TrendingUp size={12} /> -5.2% vs last 24h</span>}
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Token Efficiency</span>
            <TrendingUp className="kpi-icon green" />
          </div>
          <div className="kpi-value font-mono">{kpis.efficiency}%</div>
          {useMockData && <span className="kpi-trend positive"><TrendingUp size={12} /> +1.4% vs last 24h</span>}
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Projected Spend</span>
            <DollarSign className="kpi-icon blue" />
          </div>
          <div className="kpi-value font-mono">${kpis.spend.toFixed(4)}</div>
          {useMockData && <span className="kpi-trend negative"><TrendingUp size={12} /> +12.5% vs last 24h</span>}
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Blocked Violations</span>
            <AlertTriangle className="kpi-icon red" />
          </div>
          <div className="kpi-value font-mono">{kpis.blocked}</div>
          {useMockData && <span className="kpi-trend positive"><TrendingUp size={12} /> -2% vs last 24h</span>}
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Risk Timeline (Last 24 Hours)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={11} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-default)' }} 
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="performance" stroke="var(--color-brand-violet)" name="Performance Score" strokeWidth={2} />
                <Line type="monotone" dataKey="cost" stroke="var(--color-brand-amber)" name="Cost Score" strokeWidth={2} />
                <Line type="monotone" dataKey="responsibility" stroke="var(--color-brand-green)" name="Responsibility Score" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Model Interceptions Breakdown</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-default)' }} 
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <Bar dataKey="safe" fill="var(--color-brand-green)" name="Safe" stackId="a" />
                <Bar dataKey="flagged" fill="var(--color-brand-amber)" name="Flagged" stackId="a" />
                <Bar dataKey="blocked" fill="var(--color-brand-red)" name="Blocked" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style jsx>{`
        .page-header {
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

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .kpi-card {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kpi-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .kpi-icon {
          width: 20px;
          height: 20px;
        }

        .kpi-icon.violet { color: var(--color-brand-violet); }
        .kpi-icon.green { color: var(--color-brand-green); }
        .kpi-icon.blue { color: var(--color-brand-blue); }
        .kpi-icon.red { color: var(--color-brand-red); }

        .kpi-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .kpi-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .kpi-trend.positive {
          color: var(--color-brand-green);
        }

        .kpi-trend.negative {
          color: var(--color-brand-red);
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        @media (min-width: 1024px) {
          .charts-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .chart-card {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .chart-title {
          font-size: 16px;
          font-weight: 600;
        }

        .chart-container {
          height: 320px;
          width: 100%;
        }

        .font-mono {
          font-family: var(--font-mono);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .context-badge {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-brand-blue);
        }

        .context-label {
          color: var(--text-secondary);
        }

        .context-detail {
          color: var(--text-tertiary);
        }

        .filters-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-surface-1);
          padding: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
        }

        .filter-group-container {
          display: flex;
          gap: 16px;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .filter-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
        }

        .filter-group select {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          padding: 8px 12px;
          border-radius: var(--radius-md);
          font-size: 13px;
          cursor: pointer;
        }

        .filter-group select:focus {
          outline: 1px solid var(--color-brand-blue);
        }

        .clear-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          color: var(--color-brand-red);
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
          border-color: var(--color-brand-red);
        }

        .clear-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          color: var(--text-tertiary);
          border-color: var(--border-default);
        }
      `}</style>
    </DashboardLayout>
  );
}
