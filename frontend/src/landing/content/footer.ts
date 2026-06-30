export const footerContent = {
  description:
    "ProjectPilot gives project and portfolio managers full visibility into governance, risks, and delivery health across every initiative your team runs.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "/features" },
        { label: "Workflow", href: "/workflow" },
        { label: "Pricing", href: "/pricing" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Cookie Policy", href: "/cookies" },
      ],
    },
  ],
  copyright: `\u00A9 ${new Date().getFullYear()} ProjectPilot. All rights reserved.`,
} as const;
