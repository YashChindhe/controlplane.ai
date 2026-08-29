"use client";

import React, { useState } from 'react';
import Sidebar from '../components/sidebar';
import { Sun, Moon, Bell } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-wrapper">
        <header className="main-header">
          <div className="header-status">
            <span className="status-dot online"></span>
            <span className="status-text">Interception Engine Online</span>
          </div>
          <div className="header-actions">
            <button className="icon-btn theme-toggle" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn notifications-btn" title="System Alerts">
              <Bell size={18} />
              <span className="badge-count">1</span>
            </button>
          </div>
        </header>
        <main className="content-container">
          {children}
        </main>
      </div>

      <style jsx>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg-base);
        }

        .main-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .main-header {
          height: 64px;
          border-bottom: 1px solid var(--border-subtle);
          background-color: var(--bg-surface-1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .header-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.online {
          background-color: var(--color-brand-green);
          box-shadow: 0 0 8px var(--color-brand-green);
        }

        .status-text {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-btn {
          background: transparent;
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: all var(--transition-fast);
        }

        .icon-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background-color: var(--bg-surface-2);
        }

        .badge-count {
          position: absolute;
          top: -4px;
          right: -4px;
          background-color: var(--color-brand-red);
          color: white;
          font-size: 9px;
          font-weight: 700;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .content-container {
          padding: 32px;
          flex: 1;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
