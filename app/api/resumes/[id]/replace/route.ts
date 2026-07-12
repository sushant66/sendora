import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { ResumeFileSchema } from "@/lib/validation/resumes";
import { replaceResume } from "@/lib/resumes/service";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/resumes/:id/replace — replace an active resume with a new file, archiving the
 * old version. Multipart: `file` (PDF) only — the label is inherited from the target, not
 * submitted. 404 if the target isn't found, isn't owned, or isn't currently active.
 */
export const POST = route(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");

  const validatedFile = ResumeFileSchema.parse(
    file instanceof File
      ? { name: file.name, type: file.type, size: file.size, buffer: Buffer.from(await file.arrayBuffer()) }
      : { name: "", type: "", size: 0, buffer: Buffer.alloc(0) },
  );

  const resume = await replaceResume(user.id, id, validatedFile);
  return ok(resume);
});
