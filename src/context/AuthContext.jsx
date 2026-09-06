import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchAPI } from '../lib/db';

const defaultAuthContext = {
  user: null,
  login: () => {},
  logout: () => {},
  loading: true
};

const AuthContext = createContext(defaultAuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    async function initAuth() {
      const savedUser = localStorage.getItem('crm_user');
      let initialUser = null;
      if (savedUser) {
        try {
          initialUser = JSON.parse(savedUser);
          if (!isCancelled) {
            setUser(initialUser);
          }
        } catch (e) {
        }
      }

      try {
        const res = await fetchAPI('/api/auth/login', 'GET');
        if (!isCancelled) {
          if (res && res.authenticated && res.user) {
            setUser(res.user);
            localStorage.setItem('crm_user', JSON.stringify(res.user));
          } else {
            setUser(null);
            localStorage.removeItem('crm_user');
          }
        }
      } catch (e) {
        if (!isCancelled && !initialUser) {
          setUser(null);
          localStorage.removeItem('crm_user');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    initAuth();
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      localStorage.removeItem('crm_user');
    };
    window.addEventListener('crm_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('crm_unauthorized', handleUnauthorized);
  }, []);

  const login = (id, name, role) => {
    const newUser = { id, name, role };
    setUser(newUser);
    localStorage.setItem('crm_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      await fetchAPI('/api/auth/login', 'DELETE');
    } catch (e) {
      console.warn('Server logout call skipped or failed', e);
    }
    setUser(null);
    localStorage.removeItem('crm_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn("[useAuth] AuthContext accessed outside AuthProvider, using default fallback.");
    return defaultAuthContext;
  }
  return context;
}

