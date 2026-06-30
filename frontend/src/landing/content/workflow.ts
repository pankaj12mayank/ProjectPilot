export const workflowContent = {
  seo: {
    title: "How It Works \u2014 ProjectPilot",
    description:
      "Learn how ProjectPilot transforms spreadsheets into governance reports in four straightforward steps. From file upload to portfolio monitoring.",
  },
  headline: "Four Steps From Data to Decision",
  subheadline:
    "ProjectPilot fits into your existing workflow without forcing you to change how your team already works. Upload what you have, get what you need.",
  steps: [
    {
      number: "01",
      title: "Upload Your Project Files",
      description:
        "Start by uploading the three file types your team already maintains: a status tracker, a RAID log, and a weekly completion history. Both CSV and Excel formats are supported. The system inspects each file for correct column structure and data types, flagging any issues before the data is stored. If a file does not match the expected schema, you receive a clear error message telling you exactly what to fix.",
      details: [
        "Status tracker: task-level progress, owners, and due dates.",
        "RAID log: risks, assumptions, issues, and dependencies with severity ratings.",
        "Weekly history: planned vs. actual completion percentages over successive weeks.",
      ],
    },
    {
      number: "02",
      title: "Review Health Scores & Risk Data",
      description:
        "Once uploaded, the dashboard immediately displays health scores, risk heatmaps, and schedule trends for that project. The composite health score is calculated from schedule variance, risk density, and completion trajectory. You can adjust RAG thresholds to align with your organisation\u2019s governance policy. Every risk from the RAID log is surfaced with its owner, severity, and target mitigation date.",
      details: [
        "Composite health score with RAG colour coding.",
        "Risk heatmap grouped by severity and category.",
        "Schedule variance plotted against the project baseline.",
      ],
    },
    {
      number: "03",
      title: "Generate Governance Reports",
      description:
        "With a single click, produce a complete governance report package. The package includes an executive summary, health overview, risk matrix, forecast chart, and detailed appendices. Reports are generated in PDF, DOCX, and PPTX formats so you can distribute them as-is or customise them further. Every report reflects your organisation\u2019s branding automatically.",
      details: [
        "PDF for easy distribution to stakeholders.",
        "DOCX and PPTX for further editing and presentation.",
        "Branding applied from your admin panel settings.",
      ],
    },
    {
      number: "04",
      title: "Monitor the Full Portfolio",
      description:
        "As you add more projects, the portfolio view aggregates health, risks, and trends across everything you manage. Spot which projects need intervention before issues escalate. The portfolio dashboard respects role-based access: admins see everything, project owners see their own projects, and team members see what they are assigned to.",
      details: [
        "Cross-project health and risk aggregation.",
        "Role-based visibility for admins, owners, and team members.",
        "Metrics snapshots saved over time for trend analysis.",
      ],
    },
  ],
  cta: {
    headline: "Ready to Streamline Your Governance Process?",
    subheadline: "No setup fees. No long-term commitment. Start with a single project and grow from there.",
    buttonText: "Get Started Free",
    buttonHref: "/register",
  },
} as const;
