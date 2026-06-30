import { Link } from "react-router-dom";

type CTAProps = {
  headline: string;
  subheadline?: string;
  buttonText: string;
  buttonHref: string;
};

export function CTASection({ headline, subheadline, buttonText, buttonHref }: CTAProps) {
  return (
    <section className="border-t border-border/40 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-hero text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {headline}
        </h2>
        {subheadline && (
          <p className="mt-4 text-lg text-muted-foreground">{subheadline}</p>
        )}
        <div className="mt-8">
          <Link
            to={buttonHref}
            className="pp-btn pp-btn--primary inline-flex h-12 items-center rounded-xl px-8 text-base font-medium no-underline"
          >
            {buttonText}
          </Link>
        </div>
      </div>
    </section>
  );
}
