/** Minimal formatting glyphs for the rich-text toolbar. Decorative — buttons carry labels. */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function BoldGlyph() {
  return (
    <svg {...base} strokeWidth={2.25}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </svg>
  );
}

export function ItalicGlyph() {
  return (
    <svg {...base}>
      <path d="M15 5h-5M14 19H9M14 5 10 19" />
    </svg>
  );
}

export function BulletListGlyph() {
  return (
    <svg {...base}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function OrderedListGlyph() {
  return (
    <svg {...base}>
      <path d="M10 6h10M10 12h10M10 18h10M4 5v3M3.5 5H4M3 8h1.5M3 12.5c0-.5.5-1 1-1s1 .5 1 1S3 14 3 14h2M3 17.5h1.5v1.5H3v1.5h1.5" strokeWidth={1.5} />
    </svg>
  );
}

export function LinkGlyph() {
  return (
    <svg {...base}>
      <path d="M10 13a3 3 0 0 0 4.2.3l3-3a3 3 0 1 0-4.2-4.2l-1.2 1.1" />
      <path d="M14 11a3 3 0 0 0-4.2-.3l-3 3a3 3 0 1 0 4.2 4.2l1.1-1.1" />
    </svg>
  );
}
