import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/http/route";
import { noContent } from "@/lib/http/responses";
import { deleteResume, getResumeFile } from "@/lib/resumes/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/resumes/:id — stream the PDF (active or archived). 404 if not owned. */
export const GET = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const file = await getResumeFile(user.id, id);
  return new NextResponse(file.body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${file.fileName}"`,
      ...(file.contentLength !== undefined ? { "content-length": String(file.contentLength) } : {}),
    },
  });
});

/** DELETE /api/resumes/:id — soft-delete an active resume. 404 if already archived/not owned. */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteResume(user.id, id);
  return noContent();
});
