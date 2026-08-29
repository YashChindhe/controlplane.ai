"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Activity, BarChart3, Award, Settings, LogOut, Menu } from 'lucide-react';

const navItems = [
  { name: 'Live Feed', href: '/dashboard/live-feed', icon: Activity },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Compliance', href: '/dashboard/compliance', icon: Award },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Shield className="brand-logo" />
        <div className="brand-info">
          <span className="brand-name">ControlPlane.ai</span>
          <span className="brand-tag">Tri-Guard Engine</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href) || (pathname === '/' && item.href === '/dashboard/live-feed');
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="nav-icon" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">CP</div>
          <div className="user-details">
            <span className="user-name">Operations Control</span>
            <span className="user-role">Administrator</span>
          </div>
        </div>
        <button className="logout-button">
          <LogOut className="logout-icon" />
          <span>Exit Console</span>
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          width: 260px;
          background: linear-gradient(180deg, var(--bg-surface-1) 0%, var(--bg-base) 100%);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          height: 100vh;
          position: sticky;
          top: 0;
        }

        .sidebar-brand {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .brand-logo {
          color: var(--color-brand-violet);
          width: 28px;
          height: 28px;
          filter: drop-shadow(0 0 8px rgba(124, 58, 237, 0.4));
        }

        .brand-info {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          font-weight: 800;
          font-size: 16px;
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }

        .brand-tag {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-brand-violet-light);
          font-weight: 600;
        }

        .sidebar-nav {
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .nav-item:hover {
          color: var(--text-primary);
          background-color: var(--bg-surface-2);
        }

        .nav-item.active {
          color: var(--text-primary);
          background-color: var(--bg-overlay);
          border: 1px solid var(--border-brand);
          box-shadow: inset 0 0 12px rgba(124, 58, 237, 0.15);
        }

        .nav-icon {
          width: 18px;
          height: 18px;
        }

        .sidebar-footer {
          padding: 20px 16px;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--gradient-brand);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
        }

        .user-details {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .user-role {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .logout-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: transparent;
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: 10px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .logout-button:hover {
          color: var(--color-brand-red);
          border-color: var(--color-brand-red);
          background: rgba(239, 68, 68, 0.05);
        }

        .logout-icon {
          width: 16px;
          height: 16px;
        }
      `}</style>
    </aside>
  );
}
