"use client";

import React from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Award, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

const MOCK_REGULATIONS = [
  {
    id: "gdpr",
    name: "GDPR (Article 32 / PII)",
    status: "compliant",
    description: "Protection of personal data, including email redactions and IP masking rules.",
    violations: 3,
  },
  {
    id: "hipaa",
    name: "HIPAA Security Rule",
    status: "compliant",
    description: "Ensuring health records and identifiers are not processed or leaked without consent.",
    violations: 0,
  },
  {
    id: "eu-ai-act",
    name: "EU AI Act Compliance",
    status: "warning",
    description: "Verification of model output quality, ensuring no toxic, biased, or restricted advice is served.",
    violations: 14,
  },
  {
    id: "ccpa",
    name: "CCPA (California Privacy)",
    status: "compliant",
    description: "Allows consumers request deletion of stored inputs or block custom marketing PII leakage.",
    violations: 1,
  }
];

export default function CompliancePage() {
  const [useMockData, setUseMockData] = React.useState(false);
  const [regs, setRegs] = React.useState<any[]>([]);

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
        setRegs(MOCK_REGULATIONS);
        return;
      }

      try {
        const res = await fetch('http://localhost:8002/audit', {
          headers: { 'tenant-id': 'default' }
        });
        
        if (res.ok) {
          const data = await res.json();
          const events = data.events || [];

          // Map events to regulatory categories
          let gdprViolations = 0;
          let hipaaViolations = 0;
          let euAiActViolations = 0;
          let internalViolations = 0;

          events.forEach((e: any) => {
            const evalData = e.evaluation || {};
            if (evalData.responsibility?.hasPii) {
              gdprViolations++;
              if (evalData.responsibility.matchedEntities?.includes('SSN')) {
                hipaaViolations++;
              }
            }
            if (evalData.performance?.score < 70) euAiActViolations++;
            if (evalData.cost?.density < 0.5) internalViolations++;
          });

          // Generate dynamic heatmap blocks based on total events
          const heatmapBase = Array(30).fill(0);
          
          setRegs([
            {
              id: 'gdpr',
              name: 'GDPR / CCPA',
              description: 'General Data Protection Regulation. Redacts PII including names, emails, phones, and addresses.',
              status: gdprViolations > 5 ? 'review' : 'compliant',
              violations: gdprViolations,
              heatmap: heatmapBase.map((_, i) => i > 25 ? Math.floor(gdprViolations / 3) : 0)
            },
            {
              id: 'hipaa',
              name: 'HIPAA',
              description: 'Health Insurance Portability Act. Ensures medical IDs and SSNs are fully blocked.',
              status: hipaaViolations > 0 ? 'review' : 'compliant',
              violations: hipaaViolations,
              heatmap: heatmapBase.map((_, i) => i > 25 ? Math.floor(hipaaViolations / 2) : 0)
            },
            {
              id: 'eu-ai-act',
              name: 'EU AI Act (Annex III)',
              description: 'High-Risk AI Systems regulation. Demands strict bounds on hallucination and bias.',
              status: euAiActViolations > 2 ? 'review' : 'compliant',
              violations: euAiActViolations,
              heatmap: heatmapBase.map((_, i) => i > 25 ? Math.floor(euAiActViolations / 2) : 0)
            },
            {
              id: 'internal',
              name: 'Internal Spend Policy',
              description: 'Corporate governance for AI compute efficiency and maximum token allowances.',
              status: internalViolations > 5 ? 'review' : 'compliant',
              violations: internalViolations,
              heatmap: heatmapBase.map((_, i) => i > 25 ? Math.floor(internalViolations / 2) : 0)
            }
          ]);
        } else {
          setRegs([]);
        }
      } catch (err) {
        console.error("Failed to fetch compliance analytics:", err);
      }
    }
    fetchLiveData();
  }, [useMockData]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Regulatory Compliance Matrix</h1>
          <p className="page-subtitle">Mapping active guards, redacts, and violations to global compliance frameworks</p>
        </div>
      </div>

      <div className="matrix-grid">
        {regs.map((reg) => (
          <div key={reg.id} className={`reg-card ${reg.status}`}>
            <div className="card-header">
              <div className="title-area">
                <Award className="reg-icon" />
                <h3 className="reg-name">{reg.name}</h3>
              </div>
              <span className={`status-pill ${reg.status}`}>
                {reg.status === 'compliant' ? 'Compliant' : 'Needs Review'}
              </span>
            </div>

            <p className="reg-desc">{reg.description}</p>

            <div className="card-footer">
              <div className="footer-metric">
                <span className="metric-label">Active Guardrails</span>
                <span className="metric-val">3 active</span>
              </div>
              <div className="footer-metric">
                <span className="metric-label">Interceptions (24h)</span>
                <span className={`metric-val ${reg.violations > 0 ? 'text-warn' : ''}`}>
                  {reg.violations} incidents
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="compliance-summary">
        <h3 className="summary-title">System Compliance Health Score</h3>
        <div className="score-wrapper">
          <div className="score-meter">
            <div className="score-fill"></div>
            <span className="score-text">{useMockData ? '92%' : 'N/A'}</span>
          </div>
          <div className="summary-details">
            <p className="summary-p">
              {useMockData ? (
                <>
                  <strong>92/100 Governance Rating.</strong> Your models are actively redacting PII according to GDPR and HIPAA frameworks.
                  The recent hallucination surge on <code>llama-3-70b</code> generated minor warning events mapping to EU AI Act quality metrics.
                </>
              ) : (
                <>
                  <strong>No Rating Available.</strong> Enable mock data or connect to a live environment to generate a compliance score.
                </>
              )}
            </p>
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

        .matrix-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        @media (min-width: 768px) {
          .matrix-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .reg-card {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all var(--transition-fast);
        }

        .reg-card:hover {
          border-color: var(--border-default);
          transform: translateY(-2px);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .title-area {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .reg-icon {
          color: var(--color-brand-violet);
          width: 24px;
          height: 24px;
        }

        .reg-name {
          font-size: 16px;
          font-weight: 600;
        }

        .status-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 99px;
          text-transform: uppercase;
        }

        .status-pill.compliant {
          color: var(--color-brand-green);
          background: rgba(16, 185, 129, 0.1);
        }

        .status-pill.warning {
          color: var(--color-brand-amber);
          background: rgba(245, 158, 11, 0.1);
        }

        .reg-desc {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          flex: 1;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid var(--border-subtle);
          padding-top: 16px;
        }

        .footer-metric {
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

        .metric-val {
          font-size: 13px;
          font-weight: 600;
        }

        .text-warn {
          color: var(--color-brand-amber);
        }

        .compliance-summary {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .summary-title {
          font-size: 16px;
          font-weight: 600;
        }

        .score-wrapper {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .score-meter {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 6px solid var(--border-default);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .score-text {
          font-size: 20px;
          font-weight: 700;
          font-family: var(--font-mono);
        }

        .summary-details {
          flex: 1;
        }

        .summary-p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
        }
      `}</style>
    </DashboardLayout>
  );
}
