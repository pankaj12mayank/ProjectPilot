type WorkflowProps = {
  headline: string;
  subheadline?: string;
  steps: { number: string; title: string; description: string; details?: string[] }[];
};

export function WorkflowSection({ headline, subheadline, steps }: WorkflowProps) {
  return (
    <section className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-hero text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {headline}
        </h2>
        {subheadline && (
          <p className="mt-4 text-lg text-muted-foreground">{subheadline}</p>
        )}
        <div className="mt-12 space-y-12">
          {steps.map((step, i) => (
            <div key={step.number} className="relative pl-14">
              <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.number}
              </div>
              {i < steps.length - 1 && (
                <div className="absolute left-[19px] top-10 h-full w-px bg-border" aria-hidden />
              )}
              <div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                {step.details && step.details.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {step.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
