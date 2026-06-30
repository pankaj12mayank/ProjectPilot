import { useEffect } from "react";
import { aboutContent } from "../content/about";

export default function AboutPage() {
  useEffect(() => {
    document.title = aboutContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = aboutContent.seo.description;
  }, []);

  return (
    <main>
      <section className="px-4 pb-8 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-hero text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {aboutContent.hero.headline}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {aboutContent.hero.subheadline}
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-hero text-2xl font-bold text-foreground sm:text-3xl">
            {aboutContent.mission.headline}
          </h2>
          <div className="mt-6 space-y-4">
            {aboutContent.mission.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            {aboutContent.values.map((value) => (
              <div key={value.title} className="text-center">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
