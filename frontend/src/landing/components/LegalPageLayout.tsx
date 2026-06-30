import type { ReactNode } from "react";

type LegalProps = {
  title: string;
  updated: string;
  sections: { heading: string; content: string }[];
};

export function LegalPageLayout({ title, updated, sections }: LegalProps) {
  return (
    <div className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <article className="prose prose-sm prose-gray mx-auto max-w-3xl dark:prose-invert">
        <h1 className="font-hero text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold text-foreground">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.content}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
