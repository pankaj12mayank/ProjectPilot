export const featuresContent = {
  seo: {
    title: "Features \u2014 ProjectPilot",
    description:
      "Explore every feature ProjectPilot offers: file upload, validation, health scoring, risk management, portfolio dashboards, and automated governance reports.",
  },
  headline: "Every Feature Designed for Project Governance",
  subheadline:
    "ProjectPilot covers the full lifecycle from data ingestion to stakeholder reporting. No bloat, no fluff \u2014 just the tools your PMO actually needs.",
  categories: [
    {
      title: "Data Ingestion & Validation",
      items: [
        {
          name: "Multi-Format Upload",
          description:
            "Upload status trackers, RAID logs, and weekly completion files in CSV or Excel format. The system detects column layouts and validates every row before storage.",
        },
        {
          name: "Column Schema Enforcement",
          description:
            "Define expected columns per file role. Files that deviate from the schema are rejected with clear error messages, so bad data never enters the system.",
        },
        {
          name: "Bulk Import",
          description:
            "Process multiple files in a single session. Useful when onboarding existing projects or refreshing data for a new reporting period.",
        },
      ],
    },
    {
      title: "Health & Performance Analytics",
      items: [
        {
          name: "Composite Health Score",
          description:
            "A weighted score that combines schedule variance, risk density, and completion trend. Visual RAG indicators make it obvious which projects need attention.",
        },
        {
          name: "Schedule Variance Tracking",
          description:
            "Compare planned versus actual completion across weeks. The system calculates variance automatically and flags projects that are slipping.",
        },
        {
          name: "Trend Forecasting",
          description:
            "Linear projection based on historical completion data. See at a glance whether a project is on track to finish within its baseline timeline.",
        },
      ],
    },
    {
      title: "Risk & Issue Management",
      items: [
        {
          name: "RAID Log Parsing",
          description:
            "Risks, assumptions, issues, and dependencies are extracted from your uploaded RAID log. Each item is categorised and ranked by severity.",
        },
        {
          name: "Severity Heatmap",
          description:
            "Visualise risks across the portfolio with colour-coded matrices. Identify clusters of high-severity items before they become blockers.",
        },
        {
          name: "Mitigation Tracking",
          description:
            "Assign owners and target dates to risks. The dashboard shows overdue mitigations alongside active risks for complete governance coverage.",
        },
      ],
    },
    {
      title: "Reporting & Documentation",
      items: [
        {
          name: "Automated Report Packages",
          description:
            "Generate a full governance report package in PDF, DOCX, and PPTX formats. Each package includes health summaries, risk matrices, forecast charts, and supporting data.",
        },
        {
          name: "Custom Branding",
          description:
            "Upload your organisation\u2019s logo, set a favicon, and define brand colours. Reports and the platform UI reflect your brand automatically.",
        },
        {
          name: "Snapshot History",
          description:
            "Metrics snapshots are saved over time, giving you an audit trail of health and risk changes. Useful for retrospective reviews and Lessons Learned sessions.",
        },
      ],
    },
    {
      title: "Portfolio & Administration",
      items: [
        {
          name: "Cross-Project Dashboard",
          description:
            "View aggregated metrics, risk profiles, and completion trends across all projects you have access to. Filter by status, owner, or date range.",
        },
        {
          name: "Role-Based Access",
          description:
            "Admins see everything. Project owners see their own projects. Team members see assigned work. Access is controlled through the admin panel and JWT authentication.",
        },
        {
          name: "Activity Audit Log",
          description:
            "Every significant action is logged with a timestamp and user identity. Review the audit trail from the admin panel for compliance and troubleshooting.",
        },
      ],
    },
  ],
} as const;
