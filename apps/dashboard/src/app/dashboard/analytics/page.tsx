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
import { TrendingUp, DollarSign, Cpu, AlertTriangle } from 'lucide-react';

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
  const [timelineData, setTimelineData] = React.useState<any[]>([]);
  const [volumeData, setVolumeData] = React.useState<any[]>([]);
  const [kpis, setKpis] = React.useState({ latency: 0, efficiency: 0, spend: 0, blocked: 0 });

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
      if (useMockData) {
        setTimelineData(MOCK_TIMELINE);
        setVolumeData(MOCK_VOLUME);
        setKpis({ latency: 38, efficiency: 84.2, spend: 184.22, blocked: 19 });
        return;
      }

      try {
        const res = await fetch('http://localhost:8002/audit', {
          headers: { 'tenant-id': 'default' }
        });
        if (res.ok) {
          const data = await res.json();
          const events = data.events || [];
          
          if (events.length === 0) {
            setTimelineData([]);
            setVolumeData([]);
            setKpis({ latency: 0, efficiency: 0, spend: 0, blocked: 0 });
            return;
          }

          // Compute KPIs
          let totalDensity = 0;
          let totalTokens = 0;
          let blockedCount = 0;
          
          events.forEach((e: any) => {
            const evalData = e.evaluation || {};
            totalDensity += evalData.cost?.density || 1;
            totalTokens += evalData.cost?.tokens || 0;
            if (evalData.action === 'block') blockedCount++;
          });

          const avgEfficiency = (totalDensity / events.length) * 100;
          const totalSpend = totalTokens * 0.00015; // Mock rate of $0.00015 per token

          setKpis({ 
            latency: 42, // Latency telemetry not yet in gateway emit
            efficiency: parseFloat(avgEfficiency.toFixed(1)), 
            spend: parseFloat(totalSpend.toFixed(4)), 
            blocked: blockedCount 
          });

          // Compute Timeline Data (grouping sequentially for the demo)
          const timeline = events.slice(0, 10).reverse().map((e: any, idx: number) => {
            const evalData = e.evaluation || {};
            return {
              time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              performance: evalData.performance?.score || 100,
              cost: Math.min((evalData.cost?.tokens || 0) * 2, 100), // Scaled for chart visibility
              responsibility: evalData.responsibility?.hasPii ? 40 : 100
            };
          });
          setTimelineData(timeline);

          // Compute Volume Data grouped by Model
          const modelMap: Record<string, any> = {};
          events.forEach((e: any) => {
            const model = e.model || 'unknown';
            const action = e.evaluation?.action || 'pass';
            if (!modelMap[model]) {
              modelMap[model] = { name: model, safe: 0, flagged: 0, blocked: 0 };
            }
            if (action === 'pass') modelMap[model].safe++;
            else if (action === 'block') modelMap[model].blocked++;
            else modelMap[model].flagged++; // redact and flag
          });
          setVolumeData(Object.values(modelMap));
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    }
    fetchLiveData();
  }, [useMockData]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operational Analytics</h1>
          <p className="page-subtitle">Historical performance and cost metrics for active endpoints</p>
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
      `}</style>
    </DashboardLayout>
  );
}
