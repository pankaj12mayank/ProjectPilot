import { useEffect } from "react";
import { cookiePolicyContent } from "../../content/legal/cookie-policy";
import { LegalPageLayout } from "../../components/LegalPageLayout";

export default function CookiePolicyPage() {
  useEffect(() => {
    document.title = cookiePolicyContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = cookiePolicyContent.seo.description;
  }, []);

  return (
    <main>
      <LegalPageLayout title={cookiePolicyContent.title} updated={cookiePolicyContent.updated} sections={cookiePolicyContent.sections} />
    </main>
  );
}
