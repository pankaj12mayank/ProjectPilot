import { Link } from "react-router-dom";

type HeroProps = {
  headline: string;
  subheadline: string;
  cta: { text: string; href: string };
  secondaryCta?: { text: string; href: string };
};

export function HeroSection({ headline, subheadline, cta, secondaryCta }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--brand-accent)/0.08),transparent_50%)]" />
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="font-hero text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {headline}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {subheadline}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to={cta.href}
            className="pp-btn pp-btn--primary inline-flex h-12 items-center rounded-xl px-8 text-base font-medium no-underline"
          >
            {cta.text}
          </Link>
          {secondaryCta && (
            <Link
              to={secondaryCta.href}
              className="pp-btn pp-btn--ghost inline-flex h-12 items-center rounded-xl px-8 text-base font-medium no-underline"
            >
              {secondaryCta.text}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
