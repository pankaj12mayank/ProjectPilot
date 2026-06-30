import { Link } from "react-router-dom";

type PricingProps = {
  headline: string;
  subheadline: string;
  plans: {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: { text: string; href: string };
    highlighted: boolean;
  }[];
};

export function PricingSection({ headline, subheadline, plans }: PricingProps) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-hero text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {headline}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{subheadline}</p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-primary/50 bg-card shadow-card dark:shadow-card-dark"
                  : "border-border/50 bg-card shadow-soft dark:shadow-soft-dark"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4">
                  <span className="font-hero text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">/{plan.period}</span>
                </div>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={plan.cta.href}
                className={`mt-8 inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-medium no-underline transition-colors ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {plan.cta.text}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
