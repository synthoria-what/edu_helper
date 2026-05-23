import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { CertificatePage } from "./pages/CertificatePage";
import { CoursePage } from "./pages/CoursePage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminPage";
import { TeacherPage } from "./pages/TeacherPage";
import { CourseLearnPage } from "./pages/CourseLearnPage";
import { ProfilePage } from "./pages/ProfilePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="screen-loader">Загрузка кабинета...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-courses"
        element={
          <ProtectedRoute>
            <TeacherPage />
          </ProtectedRoute>
        }
      />
      <Route path="/teacher" element={<Navigate to="/my-courses" replace />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/:courseId"
        element={
          <ProtectedRoute>
            <CoursePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/:courseId/learn"
        element={
          <ProtectedRoute>
            <CourseLearnPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/:courseId/certificate"
        element={
          <ProtectedRoute>
            <CertificatePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
