# Product

## Register

product

## Users

Job seekers running their own recruiter outreach — often mid-search, under stress, doing
this in the margins of a working day. They are not marketers and not salespeople; they
are individuals sending considered, personal 1:1 emails to recruiters from their own
inbox. Context of use: a laptop, a limited block of time, a list of recruiters, and the
emotional weight of a job hunt. They want to feel organized and in control, not like they
are operating a machine.

## Product Purpose

Sendora lets a job seeker import recruiter contacts (CSV / Excel / paste), pick or author
rich-text email templates with merge fields, and send individually personalized emails —
one at a time or in bulk — from their own connected Gmail account, so replies land back in
their real inbox. Every send is recorded with a per-recipient outcome, and the person is
warned before re-contacting someone. Success = a job seeker goes from an empty account to
a personalized recruiter email sent within five minutes, and trusts the record of what
went out.

## Brand Personality

Calm, confidence-building, precise. Three words: **composed, trustworthy, deliberate.**
The interface should lower the user's stress, not add to it: quiet surfaces, clear next
steps, honest feedback. Craft and precision in the vein of Linear (crisp, keyboard-
friendly, restrained), but paced calmer: a little more breathing room than Linear's
densest views, no urgency theater. The voice is plain and human: it explains what
happened and what to do next, and never hypes.

**No em-dashes.** User-facing copy and the content of emails Sendora sends never use the
em-dash (`—`); it reads as machine-generated and breaks the plain, human tone. Rewrite
with a period, a comma, a plain connective ("so", "and"), a colon, or parentheses
instead. (Constitution Principle V.)

## Anti-references

- **Not a spammy bulk-mail tool.** No Mailchimp/mass-blast energy, no aggressive
  gradients, no campaign-dashboard vanity metrics. This is personal outreach, not a
  broadcast. Bulk send is "many individual emails," never "one blast."
- **Not a heavy CRM.** No Salesforce-style density overload, nested panels, or enterprise
  clutter. Stay focused and light; show what the current task needs and no more.
- **Not generic AI-SaaS.** Avoid the cream/purple-gradient, identical-card-grid, tiny-
  uppercase-eyebrow template look. Coherence through the design system, not decoration.

## Design Principles

1. **Lower the stress.** Every screen has one obvious next step. Empty states teach; error
   states explain and offer a way forward. Never leave the user stuck or guessing.
2. **Sending is sacred.** Email is irreversible and tied to the user's reputation. Always
   show a truthful preview before sending, resolve every merge field (never ship a literal
   `{{token}}`), and report per-recipient outcomes honestly — including partial failure.
3. **Earned familiarity.** Use standard, boring-in-a-good-way affordances (tables, side
   nav, dialogs, forms). The tool should disappear into the task; surprise is a bug.
4. **Density with air.** Dense where scanning helps (contact lists, history rows), spacious
   where decisions are made (compose, import confirm). Rhythm, not uniform cramming.
5. **One system, no exceptions.** All UI is composed from Astryx components and tokens
   (see DESIGN.md). When a pattern is missing, extend the system with a shared themed
   component — never a local one-off style.

## Accessibility & Inclusion

WCAG 2.1 AA is a build-time requirement (Constitution Principle III), not later
remediation. Keyboard operability, visible focus, ≥4.5:1 body text contrast, correct
semantic roles, and accessible names are present when a component ships. Astryx's
accessible primitives are the default; the one custom interactive surface (the Tiptap
rich-text editor) is held to the same bar — keyboard-operable toolbar, labelled controls,
correctly exposed editable region. Respect `prefers-reduced-motion`. Users are stressed
and on varied devices/assistive tech: an inaccessible flow is a broken flow.
