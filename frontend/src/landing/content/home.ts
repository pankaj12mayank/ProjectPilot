export const homeContent: {
  seo: { title: string; description: string };
  hero: {
    headline: string;
    subheadline: string;
    cta: { text: string; href: string };
    secondaryCta: { text: string; href: string };
  };
  stats: { value: string; label: string }[];
  features: {
    headline: string;
    items: { title: string; description: string }[];
  };
  workflow: {
    headline: string;
    steps: { number: string; title: string; description: string }[];
  };
  cta: {
    headline: string;
    subheadline: string;
    buttonText: string;
    buttonHref: string;
  };
} = {
  seo: {
    title: "ProjectPilot \u2014 Project Governance & Portfolio Management Platform",
    description:
      "Track project health, manage risks, generate governance reports, and keep your entire portfolio aligned with ProjectPilot.",
  },
  hero: {
    headline: "Governance That Keeps Every Project on Track",
    subheadline:
      "From status trackers and RAID logs to portfolio-level health metrics, ProjectPilot gives program managers and PMOs a single source of truth for delivery confidence.",
    cta: { text: "Start Free", href: "/register" },
    secondaryCta: { text: "See How It Works", href: "/workflow" },
  },
  stats: [
    { value: "3+", label: "File roles supported (status, RAID, weekly history)" },
    { value: "Real-time", label: "Health scoring across every dimension that matters" },
    { value: "One-click", label: "Governance report packages you can share with stakeholders" },
  ],
  features: {
    headline: "Built Around the Way Project Teams Actually Work",
    items: [
      {
        title: "Multi-File Upload & Validation",
        description:
          "Upload status trackers, RAID logs, and weekly completion files in CSV or Excel format. The platform validates column structure and data types before ingesting, so you never work with broken data.",
      },
      {
        title: "Health Scoring That Reflects Reality",
        description:
          "Each project receives a composite health score derived from schedule variance, risk exposure, and completion trends. Configure RAG thresholds to match your organisation\u2019s risk appetite.",
      },
      {
        title: "Risk & Issue Tracking Built In",
        description:
          "RAID logs are parsed automatically. Risks are ranked by severity, and the dashboard surfaces items that need immediate attention alongside longer-term trends.",
      },
      {
        title: "Portfolio-Level Visibility",
        description:
          "See every project you own or are assigned to in a single portfolio view. Cross-project metrics, aggregated risk profiles, and trend charts give you the big picture without drowning in spreadsheets.",
      },
      {
        title: "Automated Governance Reports",
        description:
          "Generate comprehensive report packages (PDF, DOCX, PPTX) with a single click. Each package includes status summaries, risk matrices, forecast charts, and supporting documentation ready for steering committees.",
      },
      {
        title: "Role-Based Access Control",
        description:
          "Admins, project owners, and team members each see exactly what they need. Authentication is JWT-based with refresh tokens, and user management is built into the admin panel.",
      },
    ],
  },
  workflow: {
    headline: "From Spreadsheet to Governance Report in Minutes",
    steps: [
      {
        number: "01",
        title: "Upload Your Files",
        description:
          "Drop in your existing status tracker, RAID log, and weekly history. CSV and Excel are both supported, and the system validates everything on import.",
      },
      {
        number: "02",
        title: "Review Health & Risks",
        description:
          "The dashboard computes health scores, surfaces risks, and shows schedule trends. Adjust RAG thresholds to match your team\u2019s governance framework.",
      },
      {
        number: "03",
        title: "Generate Reports",
        description:
          "Click once to produce a complete governance report package. Share PDFs with executives or distribute DOCX and PPTX files for further editing.",
      },
      {
        number: "04",
        title: "Monitor the Portfolio",
        description:
          "Track multiple projects from a single portfolio dashboard. Spot emerging risks early and keep delivery confidence high across the board.",
      },
    ],
  },
  cta: {
    headline: "Ready to Bring Order to Your Project Portfolio?",
    subheadline: "Start with one project. Scale to your entire portfolio. No credit card required.",
    buttonText: "Create Your Free Account",
    buttonHref: "/register",
  },
};
