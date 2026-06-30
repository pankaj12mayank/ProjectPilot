import { useEffect } from "react";
import { workflowContent } from "../content/workflow";
import { WorkflowSection } from "../components/WorkflowSection";
import { CTASection } from "../components/CTASection";

export default function WorkflowPage() {
  useEffect(() => {
    document.title = workflowContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = workflowContent.seo.description;
  }, []);

  return (
    <main>
      <WorkflowSection
        headline={workflowContent.headline}
        subheadline={workflowContent.subheadline}
        steps={workflowContent.steps}
      />
      <CTASection
        headline={workflowContent.cta.headline}
        subheadline={workflowContent.cta.subheadline}
        buttonText={workflowContent.cta.buttonText}
        buttonHref={workflowContent.cta.buttonHref}
      />
    </main>
  );
}
