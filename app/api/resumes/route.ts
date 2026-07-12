import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { created, ok } from "@/lib/http/responses";
import { ResumeUploadSchema } from "@/lib/validation/resumes";
import { listResumes, uploadResume } from "@/lib/resumes/service";

/** GET /api/resumes?includeArchived= — list the caller's resumes (US2/US4). */
export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const result = await listResumes(user.id, { includeArchived: searchParams.get("includeArchived") === "true" });
  return ok(result);
});

/** POST /api/resumes — upload a labeled resume. Multipart: `label` (text) + `file` (PDF). */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const form = await req.formData();
  const label = form.get("label");
  const file = form.get("file");

  const input = ResumeUploadSchema.parse({
    label: typeof label === "string" ? label : "",
    file:
      file instanceof File
        ? { name: file.name, type: file.type, size: file.size, buffer: Buffer.from(await file.arrayBuffer()) }
        : { name: "", type: "", size: 0, buffer: Buffer.alloc(0) },
  });

  const resume = await uploadResume(user.id, input);
  return created(resume);
});
