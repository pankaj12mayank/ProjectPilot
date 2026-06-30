type StatsProps = {
  stats: { value: string; label: string }[];
};

export function StatsSection({ stats }: StatsProps) {
  return (
    <section className="border-y border-border/40 bg-muted/30 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-hero text-3xl font-bold text-foreground sm:text-4xl">
                {stat.value}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
