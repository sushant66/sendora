import type { ReactElement, SVGProps } from "react";

/**
 * Shared line icons for navigation and marketing surfaces.
 *
 * The Astryx semantic icon registry doesn't cover Sendora's domain nouns
 * (recruiters, templates, outreach), so these hand-drawn 24×24 line glyphs
 * fill the gap. They match the design system's 1.5px stroke weight and inherit
 * color via `currentColor`, so they theme correctly in light and dark.
 * `SideNavItem`'s `icon` prop accepts an SVG component directly (IconType).
 */

type Glyph = (props: SVGProps<SVGSVGElement>) => ReactElement;

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Sendora brand mark: an upward paper plane — composed, deliberate sending. */
export const BrandMark: Glyph = (props) => (
  <svg {...base(props)}>
    <path d="M4.5 12.5 19 5.5a.6.6 0 0 1 .84.73l-4 12.4a.6.6 0 0 1-1.08.12L11.5 13.5 4.6 11.4a.6.6 0 0 1-.1-1.1Z" />
    <path d="M11.5 13.5 19.2 6" />
  </svg>
);

export const HomeIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.5" />
  </svg>
);

export const ContactsIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2.5-4.6" />
  </svg>
);

export const TemplatesIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <path d="M6 3.5h8L18.5 8v11.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
    <path d="M13.5 3.5V8H18.5M8 12h8M8 15.5h5.5" />
  </svg>
);

export const ComposeIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <path d="M12 20h7" />
    <path d="M15.5 4.5a1.6 1.6 0 0 1 2.3 2.3L8 16.6l-3 .9.9-3 9.6-10Z" />
  </svg>
);

export const HistoryIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

/** Stacked documents: multiple labeled resume variants, distinct from TemplatesIcon's single page. */
export const ResumesIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <path d="M8.5 3.5h6L18 7v11a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" />
    <path d="M14.5 3.5V7H18" />
    <path d="M5 7.5v12.5a1 1 0 0 0 1 1h8" />
  </svg>
);

export const MailIcon: Glyph = (props) => (
  <svg {...base(props)}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="m4.5 7 7.5 5.5L19.5 7" />
  </svg>
);
