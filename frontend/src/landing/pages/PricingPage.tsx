import { useEffect, useState } from "react";
import { fetchPublicPlans, type Plan } from "../../api/plans";
import { pricingContent } from "../content/pricing";
import { PricingSection } from "../components/PricingSection";
import { FAQSection } from "../components/FAQSection";
import { PageLoader } from "../../components/PageLoader";

function planToPricing(plan: Plan) {
  const featMap: Record<string, string> = {};
  for (const f of plan.features) featMap[f.feature_key] = f.value;

  const features: string[] = [];
  if (featMap.max_projects) features.push(`Up to ${featMap.max_projects} active projects`);
  if (featMap.reports_per_project) {
    features.push(featMap.reports_per_project === "unlimited" ? "Unlimited report generation" : `${featMap.reports_per_project} report per project`);
  }
  if (featMap.branding_enabled === "true") features.push("Custom branding and white-label reports");
  if (featMap.portfolio_access === "true") features.push("Portfolio dashboard with cross-project metrics");
  if (featMap.forecast_enabled === "true") features.push("Trend forecasting");
  if (featMap.risk_heatmap === "true") features.push("Risk heatmaps");
  if (featMap.team_members && featMap.team_members !== "0") {
    features.push(featMap.team_members === "unlimited" ? "Unlimited team members" : `Up to ${featMap.team_members} team members`);
  }
  if (featMap.priority_support === "true") features.push("Priority phone and email support");
  if (featMap.sso_enabled === "true") features.push("Single sign-on (SAML/SSO)");
  if (featMap.api_access === "true") features.push("API access");

  const isHighlighted = !plan.is_free && plan.price_monthly != null && plan.price_monthly > 0;

  return {
    name: plan.name,
    price: plan.is_free ? "Free" : plan.price_monthly != null ? `\u00A3${plan.price_monthly}` : "Custom",
    period: plan.is_free ? "forever" : plan.price_monthly != null ? "per month" : "contact us",
    description: plan.description || "",
    features,
    cta: {
      text: plan.is_free ? "Create Free Account" : isHighlighted ? "Start Free Trial" : "Contact Sales",
      href: plan.is_free || isHighlighted ? "/register" : "/contact",
    },
    highlighted: isHighlighted,
  };
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = pricingContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = pricingContent.seo.description;
    fetchPublicPlans().then((data) => {
      setPlans(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><PageLoader /></div>;

  const pricingPlans = plans.map(planToPricing);

  return (
    <main>
      <PricingSection
        headline={pricingContent.headline}
        subheadline={pricingContent.subheadline}
        plans={pricingPlans.length > 0 ? pricingPlans : pricingContent.plans}
      />
      <FAQSection items={pricingContent.faq} />
    </main>
  );
}
