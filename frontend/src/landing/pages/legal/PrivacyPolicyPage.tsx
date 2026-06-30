import { useEffect } from "react";
import { privacyPolicyContent } from "../../content/legal/privacy-policy";
import { LegalPageLayout } from "../../components/LegalPageLayout";

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = privacyPolicyContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = privacyPolicyContent.seo.description;
  }, []);

  return (
    <main>
      <LegalPageLayout title={privacyPolicyContent.title} updated={privacyPolicyContent.updated} sections={privacyPolicyContent.sections} />
    </main>
  );
}
