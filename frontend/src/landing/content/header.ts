export const headerContent: {
  nav: { label: string; href: string }[];
  cta: { label: string; href: string };
  login: { label: string; href: string };
} = {
  nav: [
    { label: "Features", href: "/features" },
    { label: "Workflow", href: "/workflow" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  cta: { label: "Get Started", href: "/register" },
  login: { label: "Sign In", href: "/login" },
};
