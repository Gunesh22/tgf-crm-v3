import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id: 'attender_01', name: 'Priyanka', role: 'attender' }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for saved session
    const savedUser = localStorage.getItem('crm_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse user session', e);
      }
    }
    setLoading(false);
  }, []);

  const login = (id, name, role) => {
    const newUser = { id, name, role };
    setUser(newUser);
    localStorage.setItem('crm_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('crm_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
