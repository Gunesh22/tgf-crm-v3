import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAutoUpdater } from './hooks/useAutoUpdater';
import LoginScreen from './features/auth/LoginScreen';
import './index.css';

const AttenderWorkspace = lazy(() => import('./features/attender/AttenderWorkspace'));
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
      <div className="flex items-center space-x-3">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Loading Workspace...</span>
      </div>
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute({ children, requiredRole }) {
  const auth = useAuth() || {};
  const { user, logout, loading } = auth;
  
  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user.role) {
    if (typeof logout === 'function') logout();
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <Navigate to={`/${user.role}`} replace />;
  }
  
  return children;
}

function AppRoutes() {
  const auth = useAuth() || {};
  const { user, logout, loading } = auth;
  useAutoUpdater();

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <div className="app-container">
      <Suspense fallback={<LoadingFallback />}>
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
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" containerStyle={{ zIndex: 999999 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
