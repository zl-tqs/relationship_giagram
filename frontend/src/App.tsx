import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { WorkspacePage } from './pages/WorkspacePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/project/:projectId" element={<WorkspacePage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
