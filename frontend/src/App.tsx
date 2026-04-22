import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { isPlatformAdmin } from "./auth/roleUtils";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/PageLoader";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RequireRole } from "./routes/RequireRole";
import { AdminLayout } from "./layouts/AdminLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const GovernanceReportPage = lazy(() => import("./pages/GovernanceReportPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const CreateProjectPage = lazy(() => import("./pages/CreateProjectPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const ProjectUploadPage = lazy(() => import("./pages/ProjectUploadPage"));
const ProjectHealthPage = lazy(() => import("./pages/ProjectHealthPage"));
const ProjectForecastPage = lazy(() => import("./pages/ProjectForecastPage"));
const ProjectRecommendationsPage = lazy(() => import("./pages/ProjectRecommendationsPage"));
const ProjectReportsPage = lazy(() => import("./pages/ProjectReportsPage"));
const ProjectReportsHistoryPage = lazy(() => import("./pages/ProjectReportsHistoryPage"));
const ProjectHistoryPage = lazy(() => import("./pages/ProjectHistoryPage"));
const MetricsDashboardPage = lazy(() => import("./pages/MetricsDashboardPage"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const LogsPage = lazy(() => import("./pages/LogsPage"));
const ReportsHubPage = lazy(() => import("./pages/ReportsHubPage"));
const RisksHubPage = lazy(() => import("./pages/RisksHubPage"));
const RecommendationsHubPage = lazy(() => import("./pages/RecommendationsHubPage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminBrandingPage = lazy(() => import("./pages/AdminBrandingPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminSystemPage = lazy(() => import("./pages/AdminSystemPage"));

function AuthShell() {
  return (
    <div className="pp-auth-shell">
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function RootRedirect() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <PageLoader />;
  }
  if (user) {
    return <Navigate to={isPlatformAdmin(user.role) ? "/admin" : "/dashboard"} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<AuthShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route
          path="/admin"
          element={
            <ErrorBoundary>
              <AdminLayout />
            </ErrorBoundary>
          }
        >
          <Route element={<RequireRole roles={["admin", "super_admin"]} />}>
            <Route
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="branding"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminBrandingPage />
                </Suspense>
              }
            />
            <Route
              path="users"
              element={
                <Suspense fallback={<PageLoader />}>
                  <UsersPage />
                </Suspense>
              }
            />
            <Route
              path="audit"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminAuditPage />
                </Suspense>
              }
            />
            <Route
              path="system"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminSystemPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
        <Route
          path="/dashboard"
          element={
            <ErrorBoundary>
              <DashboardLayout />
            </ErrorBoundary>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectsPage />
              </Suspense>
            }
          />
          <Route
            path="projects/new"
            element={
              <Suspense fallback={<PageLoader />}>
                <CreateProjectPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/upload"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectUploadPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/health"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectHealthPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/forecast"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectForecastPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/recommendations"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectRecommendationsPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/reports/history"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectReportsHistoryPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/reports"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectReportsPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId/history"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectHistoryPage />
              </Suspense>
            }
          />
          <Route
            path="metrics"
            element={
              <Suspense fallback={<PageLoader />}>
                <MetricsDashboardPage />
              </Suspense>
            }
          />
          <Route
            path="portfolio"
            element={
              <Suspense fallback={<PageLoader />}>
                <PortfolioPage />
              </Suspense>
            }
          />
          <Route
            path="reports"
            element={
              <Suspense fallback={<PageLoader />}>
                <ReportsHubPage />
              </Suspense>
            }
          />
          <Route
            path="risks"
            element={
              <Suspense fallback={<PageLoader />}>
                <RisksHubPage />
              </Suspense>
            }
          />
          <Route
            path="recommendations"
            element={
              <Suspense fallback={<PageLoader />}>
                <RecommendationsHubPage />
              </Suspense>
            }
          />
          <Route
            path="templates"
            element={
              <Suspense fallback={<PageLoader />}>
                <TemplatesPage />
              </Suspense>
            }
          />
          <Route
            path="logs"
            element={
              <Suspense fallback={<PageLoader />}>
                <LogsPage />
              </Suspense>
            }
          />
          <Route
            path="projects/:projectId"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectDetailPage />
              </Suspense>
            }
          />
          <Route
            path="governance"
            element={
              <Suspense fallback={<PageLoader />}>
                <GovernanceReportPage />
              </Suspense>
            }
          />
          <Route
            path="profile"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
