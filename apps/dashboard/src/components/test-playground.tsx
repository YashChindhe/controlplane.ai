import React, { useState } from 'react';
import { Send, Terminal, Loader2, Info } from 'lucide-react';

export default function TestPlayground() {
  const [model, setModel] = useState('qwen2.5:3b');
  const [prompt, setPrompt] = useState('Analyze patient dossier and extract medication regimen.');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    setLastResult(null);

    try {
      const response = await fetch('http://127.0.0.1:3000/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'cp_test_tenant_default'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.text();
      
      if (!response.ok) {
        setError(`Error ${response.status}: ${data}`);
      } else {
        setLastResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="playground-container">
      <div className="playground-header">
        <Terminal size={18} className="text-brand" />
        <h2 className="panel-title">End-to-End Test Playground</h2>
      </div>
      
      <p className="help-text">
        Fire requests directly at the ControlPlane Gateway. The Gateway will inject your Provider API keys securely and stream the result here, while simultaneously auditing it in the Live Feed below!
      </p>

      <div className="playground-form">
        <div className="form-group">
          <label>Select Model to Test</label>
          <div className="model-selector">
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="qwen2.5:3b">Custom / Ollama: qwen2.5:3b</option>
              <option value="llama3">Custom / Ollama: llama3</option>
              <option value="mistral">Custom / Ollama: mistral</option>
              <option value="mock">Mock / Demo Mode</option>
              <option value="gpt-4o">OpenAI: gpt-4o</option>
              <option value="gpt-3.5-turbo">OpenAI: gpt-3.5-turbo</option>
              <option value="claude-3-5-sonnet-20240620">Anthropic: claude-3-5-sonnet</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Prompt payload</label>
          <textarea 
            rows={3} 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type a prompt to test governance (e.g. Try sending an email address or SSN)..."
          />
        </div>

        <div className="form-actions">
          <button 
            className={`send-btn ${loading ? 'loading' : ''}`} 
            onClick={handleSend}
            disabled={loading || !prompt.trim()}
          >
            {loading ? <Loader2 className="spinner" size={16} /> : <Send size={16} />}
            <span>{loading ? 'Routing through Gateway...' : 'Send Request'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="result-box error">
          <strong>Request Failed:</strong>
          <pre>{error}</pre>
          <p className="note"><Info size={12}/> The Gateway still logged this failure. Check the Live Feed below!</p>
        </div>
      )}

      {lastResult && (
        <div className="result-box success">
          <strong>Upstream Response:</strong>
          <pre>{lastResult}</pre>
        </div>
      )}

      <style jsx>{`
        .playground-container {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          margin-bottom: 24px;
        }

        .playground-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .text-brand {
          color: var(--color-brand-blue);
        }

        .panel-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .help-text {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .playground-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        select, textarea {
          background-color: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 12px;
          color: var(--text-primary);
          font-size: 14px;
          font-family: var(--font-mono);
          resize: vertical;
        }

        select:focus, textarea:focus {
          outline: 1px solid var(--border-brand);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .send-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--gradient-brand);
          color: var(--text-inverse);
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .send-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .result-box {
          margin-top: 24px;
          padding: 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-family: var(--font-mono);
          border: 1px solid var(--border-subtle);
        }

        .result-box strong {
          display: block;
          margin-bottom: 8px;
          font-family: var(--font-sans);
          font-weight: 600;
        }

        .result-box pre {
          white-space: pre-wrap;
          word-break: break-all;
          color: var(--text-secondary);
        }

        .result-box.error {
          background-color: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .result-box.error strong {
          color: var(--color-brand-red);
        }

        .result-box.success {
          background-color: var(--bg-surface-2);
        }

        .note {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          font-size: 12px;
          color: var(--color-brand-amber);
          font-family: var(--font-sans);
          background: rgba(245, 158, 11, 0.1);
          padding: 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
