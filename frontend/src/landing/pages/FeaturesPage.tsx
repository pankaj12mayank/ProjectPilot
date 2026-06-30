import { useEffect } from "react";
import { featuresContent } from "../content/features";
import { CTASection } from "../components/CTASection";

export default function FeaturesPage() {
  useEffect(() => {
    document.title = featuresContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = featuresContent.seo.description;
  }, []);

  return (
    <main>
      <section className="px-4 pb-8 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-hero text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {featuresContent.headline}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {featuresContent.subheadline}
          </p>
        </div>
      </section>

      {featuresContent.categories.map((category) => (
        <section key={category.title} className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              {category.title}
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {category.items.map((item) => (
                <article
                  key={item.name}
                  className="rounded-xl border border-border/50 bg-card p-6 shadow-soft transition-shadow hover:shadow-card dark:shadow-soft-dark dark:hover:shadow-card-dark"
                >
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <CTASection
        headline="Ready to Try ProjectPilot?"
        subheadline="Start with a free account and see how governance reporting can be this straightforward."
        buttonText="Get Started Free"
        buttonHref="/register"
      />
    </main>
  );
}
