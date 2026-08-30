import React, { useState, useEffect } from 'react';
import { Plus, Key, Link as LinkIcon, CheckCircle } from 'lucide-react';

interface Provider {
  id: string;
  tenant_id: string;
  provider_name: string;
  base_url: string | null;
  api_key_configured: boolean;
}

export default function ProviderConfigPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerName, setProviderName] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [tenantId, setTenantId] = useState('default');

  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch(`http://localhost:8001/api/providers/${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setProviders(data || []);
        }
      } catch (err) {
        setMessage("API Unreachable.");
      }
    }
    fetchProviders();
  }, [tenantId]);

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerName) return;

    const payload = { 
        provider_name: providerName, 
        base_url: baseUrl || null, 
        api_key: apiKey || null 
    };

    try {
      const res = await fetch(`http://localhost:8001/api/providers/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedProvider = await res.json();
        setProviders(prev => {
            const existing = prev.findIndex(p => p.provider_name === savedProvider.provider_name);
            if (existing >= 0) {
                const newArr = [...prev];
                newArr[existing] = savedProvider;
                return newArr;
            }
            return [...prev, savedProvider];
        });
        setMessage('Provider configuration saved successfully!');
        setApiKey('');
      } else {
        setMessage('API Error: Failed to save provider');
      }
    } catch (err) {
      setMessage('API Unreachable.');
    }
  };

  return (
    <div className="provider-panel-container">
      {message && (
        <div className="alert-box">
          <CheckCircle className="alert-icon" />
          <span>{message}</span>
        </div>
      )}

      <div className="studio-layout">
        <section className="builder-panel">
          <h2 className="panel-title">Add / Update Provider</h2>
          <form onSubmit={handleSaveProvider} className="rule-form">
            <div className="form-group">
              <label>Provider Type</label>
              <select value={providerName} onChange={(e) => setProviderName(e.target.value)}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">Custom Endpoint / Ollama</option>
              </select>
            </div>

            <div className="form-group">
              <label>Base URL (Optional override)</label>
              <input 
                type="text" 
                placeholder={providerName === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'http://my-internal-llm:8000/v1'} 
                value={baseUrl} 
                onChange={(e) => setBaseUrl(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Secret API Key</label>
              <input 
                type="password" 
                placeholder="sk-..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
              />
              <span className="help-text">Leave blank to keep existing key. Keys are AES-256 encrypted at rest.</span>
            </div>

            <button type="submit" className="submit-btn">
              <Plus className="icon" />
              <span>Save Configuration</span>
            </button>
          </form>
        </section>

        <section className="list-panel">
          <h2 className="panel-title">Configured Providers</h2>
          <div className="rules-list">
            {providers.length === 0 && <p style={{color: 'var(--text-tertiary)', fontSize: 14}}>No providers configured for this tenant.</p>}
            {providers.map((p) => (
              <div key={p.id} className="rule-card">
                <div className="rule-header">
                  <span className="rule-title" style={{textTransform: 'capitalize'}}>{p.provider_name}</span>
                  <span className={`status-badge production`}>
                    Active
                  </span>
                </div>

                <div className="rule-details" style={{display: 'flex', flexDirection: 'column'}}>
                  <div className="detail-item">
                    <LinkIcon size={14} className="label" />
                    <span className="val code">{p.base_url || 'Default URL'}</span>
                  </div>
                  <div className="detail-item">
                    <Key size={14} className="label" />
                    <span className="val">{p.api_key_configured ? '••••••••••••••••' : 'No Key Set'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        .provider-panel-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;
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
          grid-template-columns: 1fr 1fr;
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

        label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .help-text {
            font-size: 11px;
            color: var(--text-tertiary);
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

        .rule-details {
          display: flex;
          gap: 8px;
          font-size: 12px;
        }

        .detail-item {
          display: flex;
          gap: 6px;
          align-items: center;
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
      `}</style>
    </div>
  );
}
