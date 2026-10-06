import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AssessmentSessionProvider } from './context/AssessmentSessionContext';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ProtectedRoute, AdminRoute, StudentRoute } from './components/ProtectedRoute';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import NotFoundPage from './pages/public/NotFoundPage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import ProfilePage from './pages/student/ProfilePage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import SettingsPage from './pages/admin/SettingsPage';

// Layout wrapper to conditionally show sidebar/navbar
const Layout = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();

  if (/^\/(?:coding|debugging)\/problems(?:\/|$)/.test(location.pathname)) {
    return (
      <AssessmentSessionProvider>
        <div className="assessment-app-layout">{children}</div>
      </AssessmentSessionProvider>
    );
  }

  // For unauthenticated pages, use the basic Navbar
  if (!user) {
    return (
      <AssessmentSessionProvider>
        <>
          <Navbar />
          {children}
        </>
      </AssessmentSessionProvider>
    );
  }

  // Dashboard layout for authenticated users
  return (
    <AssessmentSessionProvider>
      <div className="app-dashboard-layout">
        <Sidebar />
        <div className="app-main-content">
          <Header />
          <main className="app-page-wrapper">
            {children}
          </main>
        </div>
      </div>
    </AssessmentSessionProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Student Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <StudentRoute>
                    <StudentDashboard />
                  </StudentRoute>
                }
              />
              {/* Retired MCQ URLs. WHY redirect instead of 404: these paths are
                  already in students' bookmarks, in the browser history of
                  anyone who used the old build, and in old emails. A redirect
                  lands them on the equivalent coding screen in one hop, whereas a
                  404 reads as "the site is broken". The `replace` keeps the dead
                  URL out of the history so Back does not bounce. */}
              <Route path="/languages" element={<Navigate to="/dashboard" replace />} />
              <Route path="/assessment/:language" element={<Navigate to="/dashboard" replace />} />
              <Route path="/results/:id" element={<Navigate to="/dashboard" replace />} />
              <Route path="/admin/questions" element={<Navigate to="/admin" replace />} />

              <Route
                path="/profile"
                element={
                  <StudentRoute>
                    <ProfilePage />
                  </StudentRoute>
                }
              />


              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <AdminRoute>
                    <StudentsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/profile"
                element={
                  <AdminRoute>
                    <SettingsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <AdminRoute>
                    <SettingsPage />
                  </AdminRoute>
                }
              />
              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </Router>
        <ToastContainer
          position="bottom-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
