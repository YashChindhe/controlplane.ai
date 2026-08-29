"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sliders, Plus, Play, ShieldAlert, Archive, FileText, CheckCircle, Trash2, Import, ArrowLeft } from 'lucide-react';

interface Rule {
  id: number;
  rule_uuid: string;
  name: string;
  guard: string;
  field: string;
  operator: string;
  threshold: string;
  action: string;
  version: number;
  status: string;
  is_active: boolean;
}

const MOCK_RULES: Rule[] = [
  { id: 1, rule_uuid: "rule-1", name: "Redact US Phone Numbers", guard: "responsibility", field: "PHONE_NUMBER", operator: "contains", threshold: "1", action: "redact", version: 1, status: "production", is_active: true },
  { id: 2, rule_uuid: "rule-2", name: "Block Hallucination > 80%", guard: "performance", field: "hallucination_score", operator: ">", threshold: "80", action: "block", version: 2, status: "staging", is_active: true },
  { id: 3, rule_uuid: "rule-3", name: "Flag High Cost Requests", guard: "cost", field: "projected_cost", operator: ">", threshold: "2.50", action: "flag", version: 1, status: "production", is_active: true }
];

export default function PolicyStudio() {
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

  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState('');
  const [guard, setGuard] = useState('responsibility');
  const [field, setField] = useState('EMAIL_ADDRESS');
  const [operator, setOperator] = useState('contains');
  const [threshold, setThreshold] = useState('1');
  const [action, setAction] = useState('redact');
  const [tenantId, setTenantId] = useState('default');

  const [message, setMessage] = useState('');

  // Fetch actual rules from Policy Service if available
  useEffect(() => {
    async function fetchRules() {
      if (useMockData) {
        setRules(MOCK_RULES);
        setMessage(''); // Clear error messages when mock mode is enabled
        return;
      }

      try {
        const res = await fetch('http://localhost:8001/rules', {
          headers: { 'tenant-id': tenantId }
        });
        if (res.ok) {
          const data = await res.json();
          setRules(data || []);
          setMessage('');
        } else {
          setRules([]);
          setMessage("Failed to fetch rules from server.");
        }
      } catch (err) {
        setRules([]);
        setMessage("API Unreachable. Enable Mock Data to preview UI.");
      }
    }
    fetchRules();
  }, [tenantId, useMockData]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const newRulePayload = { name, guard, field, operator, threshold, action };

    if (useMockData) {
      const localRule: Rule = {
        id: Math.floor(Math.random() * 1000) + 10,
        rule_uuid: Math.random().toString(36).substr(2, 9),
        name, guard, field, operator, threshold, action,
        version: 1, status: 'staging', is_active: true
      };
      setRules(prev => [...prev, localRule]);
      setMessage('Created rule locally in Staging (Mock Mode)');
      setName('');
      return;
    }

    try {
      const res = await fetch('http://localhost:8001/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'tenant-id': tenantId
        },
        body: JSON.stringify(newRulePayload)
      });
      if (res.ok) {
        const savedRule = await res.json();
        setRules(prev => [...prev, savedRule]);
        setMessage('Rule created successfully (Staging)');
      } else {
        setMessage('API Error: Failed to create rule');
      }
    } catch (err) {
      setMessage('API Unreachable.');
    }
    setName('');
  };

  const handleDeployAll = async () => {
    if (useMockData) {
      setRules(prev => prev.map(r => ({ ...r, status: 'production' })));
      setMessage('All rules promoted to Production locally (Mock Mode)');
      return;
    }

    try {
      const res = await fetch('http://localhost:8001/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'tenant-id': tenantId
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(data.message || 'Deployed to production');
        setRules(prev => prev.map(r => r.status === 'staging' ? { ...r, status: 'production' } : r));
      } else {
        setMessage('API Error: Failed to deploy');
      }
    } catch (err) {
      setMessage('API Unreachable.');
    }
  };

  const handleDeleteRule = async (ruleUuid: string) => {
    if (useMockData) {
      setRules(prev => prev.filter(r => r.rule_uuid !== ruleUuid));
      setMessage('Rule deleted locally (Mock Mode)');
      return;
    }

    try {
      const res = await fetch(`http://localhost:8001/rules/${ruleUuid}`, {
        method: 'DELETE',
        headers: { 'tenant-id': tenantId }
      });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.rule_uuid !== ruleUuid));
        setMessage('Rule deleted successfully');
      } else {
        setMessage('API Error: Failed to delete rule');
      }
    } catch (err) {
      setMessage('API Unreachable.');
    }
  };

  const handleImportPack = async (packKey: string) => {
    if (useMockData) {
      const mockTemplates: Record<string, Rule[]> = {
        gdpr: [
          { id: 101, rule_uuid: "temp-gdpr-1", name: "GDPR: Mask Emails", guard: "responsibility", field: "EMAIL_ADDRESS", operator: "contains", threshold: "1", action: "redact", version: 1, status: "staging", is_active: true },
          { id: 102, rule_uuid: "temp-gdpr-2", name: "GDPR: Block SSN", guard: "responsibility", field: "US_SSN", operator: "contains", threshold: "1", action: "block", version: 1, status: "staging", is_active: true }
        ],
        hipaa: [
          { id: 201, rule_uuid: "temp-hipaa-1", name: "HIPAA: Block MRN", guard: "responsibility", field: "MRN", operator: "contains", threshold: "1", action: "block", version: 1, status: "staging", is_active: true }
        ],
        "eu-ai-act": [
          { id: 301, rule_uuid: "temp-eu-1", name: "EU AI Act: Limit Hallucination", guard: "performance", field: "hallucination_score", operator: ">", threshold: "70", action: "block", version: 1, status: "staging", is_active: true }
        ]
      };
      
      const newRules = mockTemplates[packKey] || [];
      setRules(prev => [...prev, ...newRules]);
      setMessage(`Imported template pack: ${packKey} locally (Mock Mode)`);
      return;
    }

    try {
      const res = await fetch(`http://localhost:8001/rules/templates/import/${packKey}`, {
        method: 'POST',
        headers: { 'tenant-id': tenantId }
      });
      if (res.ok) {
        const data = await res.json();
        setRules(prev => [...prev, ...data]);
        setMessage(`Imported template pack: ${packKey}`);
      } else {
        setMessage('API Error: Failed to import pack');
      }
    } catch (err) {
      setMessage('API Unreachable.');
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
            <h1 className="page-title">Policy Studio</h1>
            <p className="page-description">Author, manage, and promote real-time guardrails and compliance rules.</p>
          </div>
        </div>
        {isAdmin && (
          <button className="deploy-btn" onClick={handleDeployAll}>
            <Play className="icon" />
            <span>Promote Staging to Production</span>
          </button>
        )}
      </header>

      {message && (
        <div className="alert-box">
          <CheckCircle className="alert-icon" />
          <span>{message}</span>
        </div>
      )}

      <div className="studio-layout">
        {/* Visual Rule Builder Panel */}
        {isAdmin ? (
          <section className="builder-panel">
            <h2 className="panel-title">Create New Rule</h2>
          <form onSubmit={handleCreateRule} className="rule-form">
            <div className="form-group">
              <label>Rule Name</label>
              <input 
                type="text" 
                placeholder="e.g. Redact GDPR phone numbers" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Guard Engine</label>
                <select value={guard} onChange={(e) => setGuard(e.target.value)}>
                  <option value="responsibility">Responsibility Guard</option>
                  <option value="performance">Performance Guard</option>
                  <option value="cost">Cost Guard</option>
                </select>
              </div>

              <div className="form-group">
                <label>Target Field</label>
                <select value={field} onChange={(e) => setField(e.target.value)}>
                  {guard === 'responsibility' && (
                    <>
                      <option value="EMAIL_ADDRESS">Email Address</option>
                      <option value="PHONE_NUMBER">Phone Number</option>
                      <option value="US_SSN">US SSN</option>
                      <option value="IBAN">IBAN</option>
                    </>
                  )}
                  {guard === 'performance' && (
                    <>
                      <option value="hallucination_score">Hallucination Score</option>
                      <option value="bias_score">Bias Score</option>
                    </>
                  )}
                  {guard === 'cost' && (
                    <>
                      <option value="projected_cost">Projected Cost ($)</option>
                      <option value="token_density">Token Density</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Operator</label>
                <select value={operator} onChange={(e) => setOperator(e.target.value)}>
                  <option value="contains">Contains / Matches</option>
                  <option value=">">&gt; (Greater Than)</option>
                  <option value="<">&lt; (Less Than)</option>
                  <option value="eq">== (Equals)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Threshold Value</label>
                <input 
                  type="text" 
                  value={threshold} 
                  onChange={(e) => setThreshold(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Policy Action</label>
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="redact">Redact / Mask Content</option>
                <option value="block">Block Response Stream</option>
                <option value="flag">Flag & Log violation</option>
                <option value="reroute">Reroute to alternative LLM</option>
              </select>
            </div>

            <button type="submit" className="submit-btn">
              <Plus className="icon" />
              <span>Add Rule (Staging)</span>
            </button>
          </form>

          {/* Seed Template Libraries */}
          <div className="template-library">
            <h3 className="sub-title">Rule Template Packs</h3>
            <div className="template-grid">
              <div className="template-card" onClick={() => handleImportPack('gdpr')}>
                <div className="pack-header">
                  <ShieldAlert className="pack-icon gdpr" />
                  <span className="pack-name">GDPR Compliance</span>
                </div>
                <p className="pack-desc">Redact PII fields like emails, phone numbers, and SSNs automatically.</p>
                <button className="import-btn"><Import size={14} /> Import</button>
              </div>

              <div className="template-card" onClick={() => handleImportPack('hipaa')}>
                <div className="pack-header">
                  <Archive className="pack-icon hipaa" />
                  <span className="pack-name">HIPAA Safeguards</span>
                </div>
                <p className="pack-desc">Prevent medical record leaks and secure personal health identification details.</p>
                <button className="import-btn"><Import size={14} /> Import</button>
              </div>

              <div className="template-card" onClick={() => handleImportPack('eu-ai-act')}>
                <div className="pack-header">
                  <FileText className="pack-icon eu-ai" />
                  <span className="pack-name">EU AI Act</span>
                </div>
                <p className="pack-desc">Block responses exceeding hallucination & bias limits under EU directives.</p>
                <button className="import-btn"><Import size={14} /> Import</button>
              </div>
            </div>
          </div>
        </section>
        ) : null}

        {/* Existing Rules List */}
        <section className="list-panel">
          <h2 className="panel-title">Active Policies</h2>
          <div className="rules-list">
            {rules.map((rule) => (
              <div key={rule.rule_uuid || rule.id} className="rule-card">
                <div className="rule-header">
                  <span className="rule-title">{rule.name}</span>
                  <span className={`status-badge ${rule.status}`}>
                    {rule.status}
                  </span>
                </div>

                <div className="rule-details">
                  <div className="detail-item">
                    <span className="label">Guard:</span>
                    <span className="val">{rule.guard}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Condition:</span>
                    <span className="val code">{rule.field} {rule.operator} {rule.threshold}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Action:</span>
                    <span className={`val action-badge ${rule.action}`}>{rule.action}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Version:</span>
                    <span className="val">v{rule.version}</span>
                  </div>
                </div>

                <div className="rule-actions">
                  <button className="delete-btn" onClick={() => handleDeleteRule(rule.rule_uuid)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

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

        .deploy-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--gradient-brand);
          border: none;
          color: white;
          padding: 12px 20px;
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .deploy-btn:hover {
          opacity: 0.9;
        }

        .alert-box {
          display: flex;
          align-items: center;
          gap: 12px;
          background-color: rgba(16, 185, 129, 0.1);
          border: 1px solid var(--color-brand-green);
          color: var(--color-brand-green-light);
          padding: 16px;
          border-radius: var(--radius-md);
          font-size: 14px;
        }

        .studio-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 32px;
        }

        .builder-panel, .list-panel {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .panel-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 12px;
        }

        .rule-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        input, select {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          color: var(--text-primary);
          font-size: 14px;
        }

        input:focus, select:focus {
          outline: 1px solid var(--border-brand);
        }

        .submit-btn {
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: var(--bg-overlay);
          border: 1px solid var(--border-brand);
          color: var(--text-primary);
          padding: 12px;
          border-radius: var(--radius-md);
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .submit-btn:hover {
          background-color: var(--bg-surface-2);
        }

        .template-library {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .sub-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .template-card {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .template-card:hover {
          border-color: var(--border-brand);
        }

        .pack-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pack-name {
          font-size: 12px;
          font-weight: 700;
        }

        .pack-desc {
          font-size: 10px;
          color: var(--text-tertiary);
          flex: 1;
        }

        .import-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: transparent;
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: 4px;
          font-size: 10px;
          border-radius: var(--radius-sm);
        }

        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .rule-card {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .rule-title {
          font-weight: 700;
          font-size: 14px;
        }

        .status-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .status-badge.production {
          background-color: rgba(16, 185, 129, 0.15);
          color: var(--color-brand-green-light);
        }

        .status-badge.staging {
          background-color: rgba(245, 158, 11, 0.15);
          color: var(--color-brand-yellow-light);
        }

        .rule-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          font-size: 12px;
        }

        .detail-item {
          display: flex;
          gap: 6px;
        }

        .detail-item .label {
          color: var(--text-secondary);
        }

        .detail-item .val {
          font-weight: 600;
        }

        .code {
          font-family: var(--font-mono);
          background-color: var(--bg-base);
          padding: 1px 4px;
          border-radius: 4px;
        }

        .action-badge {
          text-transform: capitalize;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 11px;
        }

        .action-badge.redact {
          background-color: rgba(124, 58, 237, 0.15);
          color: var(--color-brand-violet-light);
        }

        .action-badge.block {
          background-color: rgba(239, 68, 68, 0.15);
          color: var(--color-brand-red-light);
        }

        .action-badge.flag {
          background-color: rgba(245, 158, 11, 0.15);
          color: var(--color-brand-yellow-light);
        }

        .rule-actions {
          display: flex;
          justify-content: flex-end;
        }

        .delete-btn {
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: color 0.2s;
        }

        .delete-btn:hover {
          color: var(--color-brand-red);
        }
      `}</style>
    </div>
  );
}
