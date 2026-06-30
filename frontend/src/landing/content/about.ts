export const aboutContent: {
  seo: { title: string; description: string };
  hero: { headline: string; subheadline: string };
  mission: { headline: string; paragraphs: string[] };
  values: { title: string; description: string }[];
} = {
  seo: {
    title: "About \u2014 ProjectPilot",
    description:
      "Learn about ProjectPilot: our mission to simplify project governance, the story behind the platform, and the team building it.",
  },
  hero: {
    headline: "We Built ProjectPilot Because Spreadsheets Are Not Enough",
    subheadline:
      "Project governance should not require a hero to maintain. We created a platform that does the heavy lifting so project managers can focus on delivery.",
  },
  mission: {
    headline: "Our Mission",
    paragraphs: [
      "Every organisation runs projects, but few have a reliable way to track health, manage risks, and produce consistent governance reports. The usual answer is a growing collection of spreadsheets that are difficult to maintain, easy to break, and hard to share with stakeholders.",
      "ProjectPilot was built to change that. We replace fragile spreadsheet workflows with a structured platform that ingests the same data your team already produces, validates it, and turns it into actionable insights and professional reports. No new data entry. No steep learning curve.",
      "Our goal is to make project governance accessible to teams of any size. Whether you are a solo project manager or a PMO overseeing fifty initiatives, ProjectPilot adapts to the way you work.",
    ],
  },
  values: [
    {
      title: "Practical Over Perfect",
      description:
        "We prioritise features that solve real problems over theoretical ideals. Every capability in ProjectPilot exists because project managers told us they needed it.",
    },
    {
      title: "Transparency by Default",
      description:
        "Health scores, risk data, and portfolio metrics are visible to everyone who needs them. We believe informed teams make better decisions.",
    },
    {
      title: "Continuous Improvement",
      description:
        "The platform improves alongside your projects. Feedback from users drives our roadmap, and we release updates regularly based on what the community asks for.",
    },
  ],
};
