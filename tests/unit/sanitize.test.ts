import { describe, it, expect } from "vitest";
import { sanitizeRichText, htmlToPlainText } from "@/lib/sanitize";

/** Coverage for the server-side HTML sanitizer — the XSS trust boundary (FR-009a, T042). */

describe("sanitizeRichText", () => {
  it("keeps the allowed formatting tags", () => {
    const html = "<p>Hi <strong>there</strong> and <em>you</em></p><ul><li>one</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("strips scripts, images, and event handlers", () => {
    const out = sanitizeRichText('<p>ok</p><img src=x onerror="alert(1)"><script>alert(2)</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<script");
  });

  it("drops javascript: links but keeps http/https/mailto and forces safe rel", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    const safe = sanitizeRichText('<a href="https://example.com">x</a>');
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain('rel="noopener noreferrer"');
    expect(sanitizeRichText('<a href="mailto:a@b.com">m</a>')).toContain("mailto:a@b.com");
  });

  it("removes disallowed structural tags but keeps their text", () => {
    const out = sanitizeRichText("<div><h1>Title</h1><p>body</p></div>");
    expect(out).not.toContain("<div");
    expect(out).not.toContain("<h1");
    expect(out).toContain("Title");
    expect(out).toContain("<p>body</p>");
  });
});

describe("htmlToPlainText", () => {
  it("turns list items into '- ' lines and blocks into newlines", () => {
    const text = htmlToPlainText("<p>Hi</p><ul><li>one</li><li>two</li></ul>");
    expect(text).toContain("Hi");
    expect(text).toContain("- one");
    expect(text).toContain("- two");
    expect(text).not.toContain("<");
  });

  it("collapses excessive blank lines", () => {
    expect(htmlToPlainText("<p>a</p><p></p><p></p><p>b</p>")).not.toMatch(/\n{3,}/);
  });
});
