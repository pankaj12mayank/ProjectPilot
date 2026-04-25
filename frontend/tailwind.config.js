/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        brand: {
          secondary: "hsl(var(--brand-secondary) / <alpha-value>)",
          accent: "hsl(var(--brand-accent) / <alpha-value>)",
        },
        semantic: {
          success: "hsl(var(--success))",
          warning: "hsl(var(--warning))",
          danger: "hsl(var(--danger))",
        },
        rag: {
          green: "hsl(var(--rag-green))",
          amber: "hsl(var(--rag-amber))",
          red: "hsl(var(--rag-red))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        hero: ["Sora", "Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "pp-dashboard": ["clamp(1.875rem, 1.2vw + 1.35rem, 2.5rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "pp-section": ["clamp(1.375rem, 1vw + 1rem, 1.875rem)", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "pp-card-title": ["clamp(1.125rem, 0.5vw + 1rem, 1.375rem)", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "pp-kpi": ["clamp(1.75rem, 1.5vw + 1rem, 2.25rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "pp-modal-title": ["clamp(1.25rem, 0.6vw + 1rem, 1.5rem)", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
      },
      boxShadow: {
        soft: "0 1px 2px hsl(24 22% 8% / 0.04), 0 6px 28px hsl(24 18% 10% / 0.06)",
        card: "0 1px 0 hsl(30 14% 86% / 0.9), 0 12px 40px hsl(24 20% 8% / 0.06)",
        "card-hover": "0 1px 0 hsl(28 40% 52% / 0.25), 0 14px 44px hsl(24 22% 8% / 0.09)",
        "soft-dark": "0 1px 2px hsl(0 0% 0% / 0.4), 0 8px 32px hsl(0 0% 0% / 0.45)",
        "card-dark": "0 1px 0 hsl(22 8% 24% / 0.9), 0 12px 40px hsl(0 0% 0% / 0.5)",
        "card-hover-dark": "0 1px 0 hsl(36 88% 56% / 0.22), 0 18px 48px hsl(0 0% 0% / 0.55)",
        glass: "0 8px 32px hsl(24 22% 8% / 0.07), inset 0 1px 0 0 hsl(40 35% 98% / 0.55)",
        "glass-dark": "0 12px 40px hsl(0 0% 0% / 0.45), inset 0 1px 0 0 hsl(40 22% 96% / 0.05)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
