type FeaturesProps = {
  headline: string;
  items: { title: string; description: string }[];
};

export function FeaturesSection({ headline, items }: FeaturesProps) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-hero text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {headline}
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-border/50 bg-card p-6 shadow-soft transition-shadow hover:shadow-card dark:shadow-soft-dark dark:hover:shadow-card-dark"
            >
              <h3 className="font-display text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
