import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import AdminUsersPage from './pages/AdminUsersPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ProjectBugsPage from './pages/ProjectBugsPage';
import ProjectCasesPage from './pages/ProjectCasesPage';
import ProjectLayout from './pages/ProjectLayout';
import ProjectRunsPage from './pages/ProjectRunsPage';
import ProjectsPage from './pages/ProjectsPage';
import RegisterPage from './pages/RegisterPage';
import TestRunDetailPage from './pages/TestRunDetailPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<Navigate to="cases" replace />} />
            <Route path="cases" element={<ProjectCasesPage />} />
            <Route path="runs" element={<ProjectRunsPage />} />
            <Route path="bugs" element={<ProjectBugsPage />} />
          </Route>
          <Route path="/test-runs/:runId" element={<TestRunDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
