import { z } from "zod";
import { WORK_PREFERENCES } from "@/lib/profile/types";

/**
 * Zod contract for the sender profile (feature 002, US1). Every field is optional; an empty
 * or whitespace-only string normalizes to `null` so a blank field never becomes an empty
 * merge value with meaning. `link` must be an http(s) URL; `workPreference` must be one of
 * the four enum values. String fields are length-bounded so one field cannot bloat an email.
 */

const SHORT_MAX = 200; // single-line fields (name, title, skills, link, location)
const LONG_MAX = 1000; // pitch (a longer positioning statement)

/** Blank/whitespace or absent → null; otherwise the trimmed string. */
function blankToNull(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  return v;
}

function optionalText(max: number) {
  return z.preprocess(blankToNull, z.string().max(max, `keep this under ${max} characters`).nullable().default(null));
}

export const ProfileInputSchema = z.object({
  displayName: optionalText(SHORT_MAX),
  title: optionalText(SHORT_MAX),
  pitch: optionalText(LONG_MAX),
  skills: optionalText(SHORT_MAX),
  link: z.preprocess(
    blankToNull,
    z
      .url("Enter a valid URL.")
      .refine((u) => /^https?:\/\//i.test(u), "Enter a valid URL.")
      .nullable()
      .default(null),
  ),
  location: optionalText(SHORT_MAX),
  workPreference: z.preprocess(
    blankToNull,
    z
      .enum(WORK_PREFERENCES, { error: "Choose one of remote, hybrid, onsite, open." })
      .nullable()
      .default(null),
  ),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;
