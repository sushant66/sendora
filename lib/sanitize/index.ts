import sanitizeHtml from "sanitize-html";

/**
 * Server-side rich-text sanitizer (User Story 2, FR-009a).
 *
 * Strict allow-list matching the only supported formatting: bold, italic, ordered/
 * unordered lists, links, paragraphs, and line breaks. Everything else is stripped. This
 * is the authoritative trust boundary — client HTML is never trusted (Constitution I).
 */

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Force safe link behavior; drop anything that isn't an allowed scheme.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
  disallowedTagsMode: "discard",
};

/** Sanitize rich-text HTML to the supported allow-list. */
export function sanitizeRichText(dirty: string): string {
  return sanitizeHtml(dirty, OPTIONS);
}

/**
 * Derive a plain-text alternative from sanitized rich-text HTML for the
 * multipart/alternative send. Lists become "- " lines; block elements become newlines.
 */
export function htmlToPlainText(html: string): string {
  // Inject structural whitespace before stripping tags so lists/paragraphs read cleanly.
  const withBreaks = html
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<\/\s*(li|p|div|h[1-6]|ul|ol)\s*>/gi, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n");
  const text = sanitizeHtml(withBreaks, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ["style", "script"],
  });
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
