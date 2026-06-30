import { useEffect } from "react";
import { termsOfServiceContent } from "../../content/legal/terms-of-service";
import { LegalPageLayout } from "../../components/LegalPageLayout";

export default function TermsOfServicePage() {
  useEffect(() => {
    document.title = termsOfServiceContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = termsOfServiceContent.seo.description;
  }, []);

  return (
    <main>
      <LegalPageLayout title={termsOfServiceContent.title} updated={termsOfServiceContent.updated} sections={termsOfServiceContent.sections} />
    </main>
  );
}
