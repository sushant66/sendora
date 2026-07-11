import { extractTokens } from "./merge";
import { htmlToPlainText } from "@/lib/sanitize";

/**
 * Starter (system) email templates seeded for every user (User Story 2, FR-008). They are
 * read-only and use only the supported merge vocabulary. `bodyText` and `mergeFields` are
 * derived so the shape matches custom templates exactly.
 */

type StarterInput = { slug: string; name: string; subject: string; bodyHtml: string };

const STARTERS: StarterInput[] = [
  {
    slug: "intro-cold-outreach",
    name: "Intro: cold outreach",
    subject: "{{full_name}}, interested in roles at {{company}}",
    bodyHtml:
      "<p>Hi {{first_name}},</p>" +
      "<p>I came across your work at {{company}} and wanted to reach out directly. I'm exploring new opportunities and would love to be considered for relevant roles you're hiring for.</p>" +
      "<p>I've attached a short summary of my background. Happy to share more. Would you be open to a quick chat?</p>" +
      "<p>Thanks for your time,</p>",
  },
  {
    slug: "role-specific",
    name: "Role-specific interest",
    subject: "Interested in the {{role}} role at {{company}}",
    bodyHtml:
      "<p>Hi {{first_name}},</p>" +
      "<p>I saw that {{company}} is hiring for a {{role}} and it looks like a strong fit for my experience. I'd welcome the chance to be considered.</p>" +
      "<ul><li>Relevant, hands-on experience in the area</li><li>A track record of shipping and collaborating well</li></ul>" +
      "<p>Would it make sense to connect this week?</p>" +
      "<p>Best,</p>",
  },
  {
    slug: "follow-up",
    name: "Polite follow-up",
    subject: "Following up on the {{role}} role at {{company}}",
    bodyHtml:
      "<p>Hi {{first_name}},</p>" +
      "<p>Just following up on my note about the {{role}} role at {{company}}. I know things get busy, and I remain very interested and would be glad to share anything that would help.</p>" +
      "<p>Appreciate your consideration,</p>",
  },
];

export type StarterTemplate = {
  kind: "system";
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  mergeFields: string[];
};

export function buildStarterTemplates(): StarterTemplate[] {
  return STARTERS.map((s) => ({
    kind: "system",
    name: s.name,
    subject: s.subject,
    bodyHtml: s.bodyHtml,
    bodyText: htmlToPlainText(s.bodyHtml),
    mergeFields: [...new Set([...extractTokens(s.subject), ...extractTokens(s.bodyHtml)])],
  }));
}
