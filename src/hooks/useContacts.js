import { useState, useEffect, useCallback } from 'react';

export function useContacts(attenderId) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const fetchContacts = useCallback(async (page = 1, searchQuery = '') => {
    if (!attenderId) return;
    
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        attenderId,
        page,
        limit: 30
      });
      if (searchQuery) {
        queryParams.append('search', searchQuery);
      }

      // Since the API functions are in /api/, we call them directly
      // In local dev without a proxy they might 404, but we'll assume a proxy or serverless environment
      const res = await fetch(`/api/contacts/search?${queryParams.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setContacts(data.data);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch contacts');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [attenderId]);

  useEffect(() => {
    fetchContacts(1);
  }, [fetchContacts]);

  return { 
    contacts, 
    loading, 
    error, 
    pagination, 
    fetchContacts 
  };
}
