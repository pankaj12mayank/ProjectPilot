import { useState } from "react";

type ContactProps = {
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
};

export function ContactSection({
  headline,
  subheadline,
  supportEmail,
  salesEmail,
  responseTime,
  form,
}: ContactProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(form.subjects[0]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mailto = subject === "Sales & Pricing" ? salesEmail : supportEmail;
    const body = `Name: ${name}%0D%0AEmail: ${email}%0D%0A%0D%0A${message}`;
    window.open(`mailto:${mailto}?subject=${encodeURIComponent(subject)}&body=${body}`);
    setSent(true);
  }

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="font-hero text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{subheadline}</p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <span>Support: <a href={`mailto:${supportEmail}`} className="text-foreground underline underline-offset-2">{supportEmail}</a></span>
          <span>Sales: <a href={`mailto:${salesEmail}`} className="text-foreground underline underline-offset-2">{salesEmail}</a></span>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">{responseTime}</p>

        {sent ? (
          <div className="mt-8 rounded-xl border border-border/50 bg-card p-8 text-center shadow-soft dark:shadow-soft-dark">
            <p className="text-lg font-medium text-foreground">Message ready to send.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your default email client should open with a pre-addressed message.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-foreground">{form.nameLabel}</label>
              <input id="contact-name" className="pp-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-foreground">{form.emailLabel}</label>
              <input id="contact-email" className="pp-input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-sm font-medium text-foreground">{form.subjectLabel}</label>
              <select id="contact-subject" className="pp-input mt-1" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {form.subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-foreground">{form.messageLabel}</label>
              <textarea id="contact-message" className="pp-input mt-1 min-h-[140px]" value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <button type="submit" className="pp-btn pp-btn--primary inline-flex h-11 items-center rounded-xl px-6 text-sm font-medium">
              {form.submitText}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
