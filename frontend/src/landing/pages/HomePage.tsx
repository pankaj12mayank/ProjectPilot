import { useEffect } from "react";
import { homeContent } from "../content/home";
import { HeroSection } from "../components/HeroSection";
import { StatsSection } from "../components/StatsSection";
import { FeaturesSection } from "../components/FeaturesSection";
import { WorkflowSection } from "../components/WorkflowSection";
import { CTASection } from "../components/CTASection";

export default function HomePage() {
  useEffect(() => {
    document.title = homeContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = homeContent.seo.description;
  }, []);

  return (
    <main>
      <HeroSection
        headline={homeContent.hero.headline}
        subheadline={homeContent.hero.subheadline}
        cta={homeContent.hero.cta}
        secondaryCta={homeContent.hero.secondaryCta}
      />
      <StatsSection stats={homeContent.stats} />
      <FeaturesSection headline={homeContent.features.headline} items={homeContent.features.items} />
      <WorkflowSection
        headline={homeContent.workflow.headline}
        steps={homeContent.workflow.steps}
      />
      <CTASection
        headline={homeContent.cta.headline}
        subheadline={homeContent.cta.subheadline}
        buttonText={homeContent.cta.buttonText}
        buttonHref={homeContent.cta.buttonHref}
      />
    </main>
  );
}
