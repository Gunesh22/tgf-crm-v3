import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
