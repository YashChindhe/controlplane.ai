"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ProviderConfigPanel from '@/components/provider-config-panel';

export default function ProvidersSettings() {
  const router = useRouter();

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="header-info">
          <button className="back-btn" onClick={() => router.back()} title="Go Back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">Provider Configurations</h1>
            <p className="page-description">Manage your upstream AI model providers and API keys securely.</p>
          </div>
        </div>
      </header>

      <ProviderConfigPanel />

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
      `}</style>
    </div>
  );
}
