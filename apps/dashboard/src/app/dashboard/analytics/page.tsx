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

const riskTimelineData = [
  { time: '12:00', performance: 95, cost: 45, responsibility: 98 },
  { time: '13:00', performance: 92, cost: 55, responsibility: 99 },
  { time: '14:00', performance: 88, cost: 60, responsibility: 98 },
  { time: '15:00', performance: 94, cost: 40, responsibility: 80 },
  { time: '16:00', performance: 97, cost: 35, responsibility: 99 },
  { time: '17:00', performance: 91, cost: 70, responsibility: 95 },
  { time: '18:00', performance: 95, cost: 50, responsibility: 99 },
];

const modelVolumeData = [
  { name: 'gpt-4o', safe: 400, flagged: 24, blocked: 4 },
  { name: 'claude-3-5-sonnet', safe: 300, flagged: 18, blocked: 2 },
  { name: 'gpt-3.5-turbo', safe: 580, flagged: 45, blocked: 12 },
  { name: 'llama-3-70b', safe: 180, flagged: 8, blocked: 1 },
];

export default function AnalyticsPage() {
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
          <div className="kpi-value font-mono">38ms</div>
          <span className="kpi-trend positive"><TrendingUp size={12} /> -5.2% vs last 24h</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Token Efficiency</span>
            <TrendingUp className="kpi-icon green" />
          </div>
          <div className="kpi-value font-mono">84.2%</div>
          <span className="kpi-trend positive"><TrendingUp size={12} /> +1.4% vs last 24h</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Projected Spend</span>
            <DollarSign className="kpi-icon blue" />
          </div>
          <div className="kpi-value font-mono">$184.22</div>
          <span className="kpi-trend negative"><TrendingUp size={12} /> +12.5% vs last 24h</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Blocked Violations</span>
            <AlertTriangle className="kpi-icon red" />
          </div>
          <div className="kpi-value font-mono">19</div>
          <span className="kpi-trend positive"><TrendingUp size={12} /> -2% vs last 24h</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Risk Timeline (Last 24 Hours)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTimelineData}>
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
              <BarChart data={modelVolumeData}>
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
