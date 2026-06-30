import { useEffect } from "react";
import { contactContent } from "../content/contact";
import { ContactSection } from "../components/ContactSection";

export default function ContactPage() {
  useEffect(() => {
    document.title = contactContent.seo.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = contactContent.seo.description;
  }, []);

  return (
    <main>
      <ContactSection
        headline={contactContent.headline}
        subheadline={contactContent.subheadline}
        supportEmail={contactContent.supportEmail}
        salesEmail={contactContent.salesEmail}
        responseTime={contactContent.responseTime}
        form={contactContent.form}
      />
    </main>
  );
}
