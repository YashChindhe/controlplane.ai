"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Activity, BarChart3, Award, Settings, LogOut, Menu, Sliders, Archive, UserCheck, UserX } from 'lucide-react';

const navItems = [
  { name: 'Live Feed', href: '/dashboard/live-feed', icon: Activity },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Compliance', href: '/dashboard/compliance', icon: Award },
  { name: 'Policy Studio', href: '/dashboard/policy-studio', icon: Sliders },
  { name: 'Audit Vault', href: '/dashboard/audit-vault', icon: Archive },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(true);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [useMockData, setUseMockData] = useState(false);

  React.useEffect(() => {
    const role = localStorage.getItem('mockRole');
    if (role === 'viewer') setIsAdmin(false);
    const mock = localStorage.getItem('useMockData');
    if (mock === 'true') setUseMockData(true);
  }, []);

  const toggleMockData = () => {
    const newMock = !useMockData;
    setUseMockData(newMock);
    localStorage.setItem('useMockData', String(newMock));
    // Dispatch standard storage event so other components in the same tab update immediately
    window.dispatchEvent(new Event('storage'));
  };

  const toggleRole = (newIsAdmin: boolean) => {
    setIsAdmin(newIsAdmin);
    localStorage.setItem('mockRole', newIsAdmin ? 'admin' : 'viewer');
    window.dispatchEvent(new Event('storage'));
    setShowRoleDropdown(false);
  };

  const handleExit = () => {
    document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push('/login');
  };

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
        <button 
          className={`mock-data-toggle ${useMockData ? 'active' : ''}`} 
          onClick={toggleMockData}
          title={useMockData ? "Disable Mock Data" : "Enable Mock Data"}
        >
          <div className="toggle-indicator"></div>
          <span>{useMockData ? 'Mock Data: ON' : 'Mock Data: OFF'}</span>
        </button>

        <div className="user-profile-wrapper" style={{ position: 'relative' }}>
          <div className="user-profile" onClick={() => setShowRoleDropdown(!showRoleDropdown)} style={{ cursor: 'pointer' }} title="Account Settings">
            <div className="user-avatar">{isAdmin ? 'AD' : 'VW'}</div>
            <div className="user-details">
              <span className="user-name">{isAdmin ? 'Admin User' : 'Viewer User'}</span>
              <span className="user-role">{isAdmin ? 'Administrator' : 'Read-Only'}</span>
            </div>
            <Settings size={16} className="settings-icon" />
          </div>
          
          {showRoleDropdown && (
            <div className="role-dropdown">
              <div className="dropdown-header">Switch Account</div>
              <button 
                className={`role-option ${isAdmin ? 'active' : ''}`}
                onClick={() => { setIsAdmin(true); toggleRole(true); }}
              >
                <Shield size={14} /> Administrator
              </button>
              <button 
                className={`role-option ${!isAdmin ? 'active' : ''}`}
                onClick={() => { setIsAdmin(false); toggleRole(false); }}
              >
                <UserX size={14} /> Read-Only Viewer
              </button>
            </div>
          )}
        </div>
        <button className="logout-button" onClick={handleExit}>
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

        .mock-data-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-surface-2);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: 10px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: all var(--transition-fast);
          justify-content: center;
        }

        .mock-data-toggle:hover {
          background: var(--bg-overlay);
          color: var(--text-primary);
        }

        .mock-data-toggle.active {
          border-color: var(--color-brand-amber);
          color: var(--color-brand-amber);
          background: rgba(245, 158, 11, 0.05);
        }

        .toggle-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-tertiary);
          transition: all var(--transition-fast);
        }

        .mock-data-toggle.active .toggle-indicator {
          background: var(--color-brand-amber);
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
        }

        .role-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          width: 100%;
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 100;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .dropdown-header {
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-tertiary);
          border-bottom: 1px solid var(--border-subtle);
          background-color: var(--bg-surface-2);
        }

        .role-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .role-option:hover {
          background-color: var(--bg-surface-2);
          color: var(--text-primary);
        }

        .role-option.active {
          color: var(--color-brand-violet);
          background-color: var(--bg-overlay);
        }

        @media (max-width: 768px) {
          .sidebar {
            width: 100%;
            height: auto;
            position: static;
            border-right: none;
            border-bottom: 1px solid var(--border-subtle);
          }
          
          .sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            padding: 16px;
          }

          .nav-item {
            padding: 8px 12px;
            white-space: nowrap;
          }

          .nav-item span {
            display: none;
          }
          
          .nav-item.active span {
            display: inline-block;
          }

          .role-dropdown {
            bottom: auto;
            top: calc(100% + 8px);
          }
        }
      `}</style>
    </aside>
  );
}
