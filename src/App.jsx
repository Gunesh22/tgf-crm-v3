import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AttenderWorkspace from './features/attender/AttenderWorkspace';
import AdminDashboard from './features/admin/AdminDashboard';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Navigate to="/attender" replace />} />
          <Route path="/attender" element={<AttenderWorkspace />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
