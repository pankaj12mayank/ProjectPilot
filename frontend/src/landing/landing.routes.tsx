import { lazy, Suspense } from "react";
import { Route } from "react-router-dom";
import { PageLoader } from "../components/PageLoader";
import { LandingLayout } from "./LandingLayout";

const HomePage = lazy(() => import("./pages/HomePage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const WorkflowPage = lazy(() => import("./pages/WorkflowPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/legal/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/legal/TermsOfServicePage"));
const CookiePolicyPage = lazy(() => import("./pages/legal/CookiePolicyPage"));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export function landingRoutes() {
  return (
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
    </Route>
  );
}
