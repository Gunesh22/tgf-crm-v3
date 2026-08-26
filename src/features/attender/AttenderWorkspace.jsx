import React, { useState } from 'react';
import { PhoneCall, Search, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useContacts } from '../../hooks/useContacts';
import { formatDate } from '../../utils/dateUtils';

export default function AttenderWorkspace() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // We'll hardcode 'attender_01' for now, this would normally come from AuthContext
  const attenderId = 'attender_01';
  const { contacts, loading, error, pagination, fetchContacts } = useContacts(attenderId);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchContacts(1, searchQuery);
  };

  const handlePageChange = (newPage) => {
    fetchContacts(newPage, searchQuery);
  };

  return (
    <div className="min-h-screen animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* Header Area */}
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
            background: 'var(--color-indigo-50)',
            color: 'var(--accent-primary)',
            padding: '0.5rem',
            borderRadius: '0.5rem'
          }}>
            <PhoneCall size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Call Center Workspace</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Welcome back, Priyanka ({attenderId})</p>
          </div>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by phone, name..." 
              style={{
                padding: '0.5rem 1rem 0.5rem 2.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-color)',
                outline: 'none',
                width: '300px'
              }} 
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Search
          </button>
        </form>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '2rem', flex: '1', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem' }}>Loading contacts...</p>
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
            <p style={{ color: '#ef4444', fontSize: '1.125rem' }}>{error}</p>
            <button onClick={() => fetchContacts(1, searchQuery)} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Try Again</button>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th>Phone</th>
                    <th>Name</th>
                    <th>City</th>
                    <th>Status</th>
                    <th>Last Called</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          No contacts found.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    contacts.map(contact => {
                      const state = contact.attenderStates?.[attenderId] || {};
                      return (
                        <tr key={contact._id}>
                          <td style={{ fontWeight: '500' }}>{contact.phone}</td>
                          <td>{contact.name || 'Unknown'}</td>
                          <td>{contact.city || '-'}</td>
                          <td>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: state.status === 'Callback' ? 'var(--status-callback-bg)' : 'var(--status-pending-bg)',
                              color: state.status === 'Callback' ? 'var(--status-callback-text)' : 'var(--status-pending-text)',
                              border: `1px solid ${state.status === 'Callback' ? 'var(--status-callback-border)' : 'var(--status-pending-border)'}`
                            }}>
                              {state.status || 'Pending'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {formatDate(state.lastCalledAt) || '-'}
                          </td>
                          <td>
                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-color)',
                marginTop: '1rem'
              }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalRecords} total)
                </span>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 0.75rem' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 0.75rem' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
