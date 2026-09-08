import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { isPlatformAdmin } from "./auth/roleUtils";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/PageLoader";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RequireRole } from "./routes/RequireRole";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LandingLayout } from "./landing/LandingLayout";

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
const ProjectRisksPage = lazy(() => import("./pages/ProjectRisksPage"));
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
const AdminEmailPage = lazy(() => import("./pages/AdminEmailPage"));
const AdminActivityPage = lazy(() => import("./pages/AdminActivityPage"));
const AdminPlansPage = lazy(() => import("./pages/AdminPlansPage"));
const AdminGatewaysPage = lazy(() => import("./pages/AdminGatewaysPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/AdminSubscriptionsPage"));
const AdminAIPage = lazy(() => import("./pages/AdminAIPage"));

const HomePage = lazy(() => import("./landing/pages/HomePage"));
const FeaturesPage = lazy(() => import("./landing/pages/FeaturesPage"));
const WorkflowPage = lazy(() => import("./landing/pages/WorkflowPage"));
const PricingPage = lazy(() => import("./landing/pages/PricingPage"));
const AboutPage = lazy(() => import("./landing/pages/AboutPage"));
const ContactPage = lazy(() => import("./landing/pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./landing/pages/legal/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./landing/pages/legal/TermsOfServicePage"));
const CookiePolicyPage = lazy(() => import("./landing/pages/legal/CookiePolicyPage"));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

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

function LegacyAdminRedirect() {
  const { pathname, search } = useLocation();
  const tail = pathname.length > "/admin".length ? pathname.slice("/admin".length) : "";
  return <Navigate to={`/dashboard/admin${tail}${search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route index element={<Lazy><HomePage /></Lazy>} />
        <Route path="features" element={<Lazy><FeaturesPage /></Lazy>} />
        <Route path="workflow" element={<Lazy><WorkflowPage /></Lazy>} />
        <Route path="pricing" element={<Lazy><PricingPage /></Lazy>} />
        <Route path="about" element={<Lazy><AboutPage /></Lazy>} />
        <Route path="contact" element={<Lazy><ContactPage /></Lazy>} />
        <Route path="privacy" element={<Lazy><PrivacyPolicyPage /></Lazy>} />
        <Route path="terms" element={<Lazy><TermsOfServicePage /></Lazy>} />
        <Route path="cookies" element={<Lazy><CookiePolicyPage /></Lazy>} />
        <Route element={<AuthShell />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<LegacyAdminRedirect />} />
        <Route path="/admin/*" element={<LegacyAdminRedirect />} />
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
            path="projects/:projectId/risks"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectRisksPage />
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

          <Route
            path="subscription"
            element={
              <Suspense fallback={<PageLoader />}>
                <SubscriptionPage />
              </Suspense>
            }
          />

          <Route element={<RequireRole roles={["admin", "system_owner"]} />}>
            <Route
              path="admin"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminDashboardPage />
                </Suspense>
              }
            />
            <Route
              path="admin/branding"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminBrandingPage />
                </Suspense>
              }
            />
            <Route
              path="admin/users"
              element={
                <Suspense fallback={<PageLoader />}>
                  <UsersPage />
                </Suspense>
              }
            />
            <Route
              path="admin/audit"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminAuditPage />
                </Suspense>
              }
            />
            <Route
              path="admin/activity"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminActivityPage />
                </Suspense>
              }
            />
            <Route
              path="admin/system"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminSystemPage />
                </Suspense>
              }
            />
            <Route
              path="admin/email"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminEmailPage />
                </Suspense>
              }
            />
            <Route
              path="admin/plans"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminPlansPage />
                </Suspense>
              }
            />
            <Route
              path="admin/gateways"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminGatewaysPage />
                </Suspense>
              }
            />
            <Route
              path="admin/subscriptions"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminSubscriptionsPage />
                </Suspense>
              }
            />
            <Route
              path="admin/ai"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AdminAIPage />
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
