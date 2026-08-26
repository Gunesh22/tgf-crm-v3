import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './features/auth/LoginScreen';
import AttenderWorkspace from './features/attender/AttenderWorkspace';
import AdminDashboard from './features/admin/AdminDashboard';
import './index.css';

// Protected Route Wrapper
function ProtectedRoute({ children, requiredRole }) {
  const { user, logout } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user.role) {
    // Corrupted session from old mock logic
    logout();
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to={`/${user.role}`} replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { user, logout } = useAuth();
  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={user && user.role ? <Navigate to={`/${user.role}`} replace /> : <LoginScreen />} />
        
        <Route path="/attender" element={
          <ProtectedRoute requiredRole="attender">
            <AttenderWorkspace attenderId={user?.id} attenderName={user?.name} onExit={logout} />
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard onExit={logout} />
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
