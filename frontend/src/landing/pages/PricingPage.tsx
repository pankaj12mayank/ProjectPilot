import { useEffect } from "react";
import { pricingContent } from "../content/pricing";
import { PricingSection } from "../components/PricingSection";
import { FAQSection } from "../components/FAQSection";

export default function PricingPage() {
  useEffect(() => {
    document.title = pricingContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = pricingContent.seo.description;
  }, []);

  return (
    <main>
      <PricingSection
        headline={pricingContent.headline}
        subheadline={pricingContent.subheadline}
        plans={pricingContent.plans}
      />
      <FAQSection items={pricingContent.faq} />
    </main>
  );
}
