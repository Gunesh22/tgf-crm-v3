import React from 'react';
import { LayoutDashboard } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      <header style={{ 
        background: 'var(--bg-secondary)', 
        padding: '1rem 2rem', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'var(--color-slate-100)',
            color: 'var(--color-slate-700)',
            padding: '0.5rem',
            borderRadius: '0.5rem'
          }}>
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Admin Dashboard</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>System Metrics & Team Overview</p>
          </div>
        </div>
      </header>

      <main style={{ padding: '2rem', flex: '1', overflow: 'auto' }}>
         <div style={{ 
           display: 'grid', 
           gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
           gap: '1.5rem' 
         }}>
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Active Leads</h3>
              <p style={{ fontSize: '2rem', fontWeight: '600', marginTop: '0.5rem' }}>0</p>
            </div>
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calls Today</h3>
              <p style={{ fontSize: '2rem', fontWeight: '600', marginTop: '0.5rem' }}>0</p>
            </div>
         </div>
      </main>
    </div>
  );
}
