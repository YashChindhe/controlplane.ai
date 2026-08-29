"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    document.cookie = "auth=1; path=/";
    router.push('/dashboard/live-feed');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="brand">
          <Shield className="brand-logo" size={48} />
          <h1>ControlPlane.ai</h1>
          <p>Tri-Guard Engine</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" placeholder="admin@controlplane.ai" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" required />
          </div>
          <button type="submit" className="login-btn">Sign In</button>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--bg-base);
        }
        .login-box {
          background-color: var(--bg-surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .brand {
          text-align: center;
          margin-bottom: 32px;
        }
        .brand-logo {
          color: var(--color-brand-violet);
          margin-bottom: 16px;
        }
        .brand h1 {
          font-size: 24px;
          margin-bottom: 4px;
        }
        .brand p {
          color: var(--color-brand-violet-light);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group label {
          font-size: 13px;
          color: var(--text-secondary);
        }
        .form-group input {
          padding: 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-default);
          background-color: var(--bg-surface-2);
          color: var(--text-primary);
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--color-brand-violet);
        }
        .login-btn {
          margin-top: 8px;
          padding: 12px;
          border-radius: var(--radius-md);
          background: var(--gradient-brand);
          color: white;
          font-weight: 600;
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
