export const contactContent: {
  seo: { title: string; description: string };
  headline: string;
  subheadline: string;
  supportEmail: string;
  salesEmail: string;
  responseTime: string;
  form: {
    nameLabel: string;
    emailLabel: string;
    subjectLabel: string;
    messageLabel: string;
    submitText: string;
    subjects: string[];
  };
} = {
  seo: {
    title: "Contact \u2014 ProjectPilot",
    description:
      "Get in touch with the ProjectPilot team. Whether you have a question, need support, or want to discuss enterprise licensing, we are here to help.",
  },
  headline: "Get in Touch",
  subheadline:
    "Have a question about ProjectPilot? Need help with setup? Interested in enterprise licensing? Reach out and we will get back to you within one business day.",
  supportEmail: "support@projectpilot.com",
  salesEmail: "sales@projectpilot.com",
  responseTime: "We aim to respond to all inquiries within one business day.",
  form: {
    nameLabel: "Your Name",
    emailLabel: "Email Address",
    subjectLabel: "Subject",
    messageLabel: "Message",
    submitText: "Send Message",
    subjects: [
      "General Inquiry",
      "Technical Support",
      "Sales & Pricing",
      "Partnership Opportunity",
      "Other",
    ],
  },
};
