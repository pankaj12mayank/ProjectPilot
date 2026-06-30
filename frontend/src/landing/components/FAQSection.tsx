import { useState } from "react";

type FAQProps = {
  items: { q: string; a: string }[];
};

export function FAQSection({ items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-3">
        {items.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={faq.q}
              className="rounded-xl border border-border/50 bg-card shadow-soft dark:shadow-soft-dark"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium text-foreground"
              >
                {faq.q}
                <svg
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isOpen && (
                <div className="border-t border-border/50 px-6 py-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
