/** Template + send DTOs shared across the server/client boundary (no server-only imports). */

export type TemplateKind = "system" | "custom";

export type Template = {
  id: string;
  kind: TemplateKind;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  mergeFields: string[];
  createdAt: string;
};

export type PreviewWarning = { field: string; message: string };

export type TemplatePreview = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  warnings: PreviewWarning[];
};
