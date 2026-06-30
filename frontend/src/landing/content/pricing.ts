export const pricingContent = {
  seo: {
    title: "Pricing \u2014 ProjectPilot",
    description:
      "Simple, transparent pricing for project governance and portfolio management. Start free and scale as your team grows.",
  },
  headline: "Simple Pricing. No Surprises.",
  subheadline:
    "ProjectPilot is designed for teams that need governance without enterprise complexity. Start with the free tier and upgrade when you are ready.",
  plans: [
    {
      name: "Starter",
      price: "Free",
      period: "forever",
      description: "For individual project managers who want to try governance reporting.",
      features: [
        "Up to 2 active projects",
        "All file roles (status, RAID, weekly)",
        "Health scoring and RAG indicators",
        "Single governance report per project",
        "Email support",
      ],
      cta: { text: "Create Free Account", href: "/register" },
      highlighted: false,
    },
    {
      name: "Professional",
      price: "\u00A329",
      period: "per month",
      description: "For PMOs managing multiple projects with regular reporting cycles.",
      features: [
        "Up to 15 active projects",
        "Unlimited report generation",
        "Portfolio dashboard with cross-project metrics",
        "Risk heatmaps and trend forecasting",
        "Custom branding and white-label reports",
        "Priority email support",
      ],
      cta: { text: "Start Free Trial", href: "/register" },
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "contact us",
      description: "For organisations with complex governance requirements and dedicated compliance needs.",
      features: [
        "Unlimited projects",
        "Dedicated onboarding and training",
        "Custom integration support",
        "SLA guarantees",
        "Single sign-on (SAML/SSO)",
        "Phone and email support with assigned account manager",
      ],
      cta: { text: "Contact Sales", href: "/contact" },
      highlighted: false,
    },
  ],
  faq: [
    {
      q: "Can I switch plans later?",
      a: "Yes. You can upgrade or downgrade at any time. When you upgrade, features become available immediately. When you downgrade, your account adjusts at the next billing cycle.",
    },
    {
      q: "Is there a free trial for paid plans?",
      a: "Yes. Professional plan includes a 14-day free trial with full access to every feature. No credit card required.",
    },
    {
      q: "What happens when I reach my project limit?",
      a: "You will see a notification in the dashboard. Existing projects remain accessible, but you will not be able to create new projects until you upgrade or archive unused ones.",
    },
    {
      q: "Do you offer discounts for non-profits or educational institutions?",
      a: "Yes. Contact our sales team with proof of eligibility, and we will apply a discount to any plan.",
    },
  ],
} as const;
