"use client";

import { useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { FileInput } from "@astryxdesign/core/FileInput";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Resume } from "@/lib/resumes/types";

// Guard the size in the browser BEFORE reading/POSTing the file so an oversized PDF fails
// fast with a clear message instead of being buffered into memory and rejected on a
// round-trip (mirrors the CSV import flow). The server re-validates as the authoritative
// trust boundary (FR-003).
const MAX_FILE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;

export function UploadResumeDialog({
  isOpen,
  onOpenChange,
  onUploaded,
  replacing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (resume: Resume) => void;
  /** Present → update this resume's file (no label field); absent → create a new one. */
  replacing?: Resume;
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
      <DialogHeader
        title={replacing ? "Update resume" : "Upload resume"}
        subtitle={replacing ? `Replace the file for "${replacing.label}" with a new PDF.` : undefined}
      />
      {/* Keyed so reopening the dialog (or switching target) remounts with fresh state. */}
      <UploadForm
        key={isOpen ? `open:${replacing?.id ?? "new"}` : "closed"}
        replacing={replacing}
        onCancel={() => onOpenChange(false)}
        onUploaded={(resume) => {
          onUploaded(resume);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

function UploadForm({
  replacing,
  onCancel,
  onUploaded,
}: {
  replacing?: Resume;
  onCancel: () => void;
  onUploaded: (resume: Resume) => void;
}) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    setIsUploading(true);
    setLabelError(undefined);
    setFileError(undefined);
    try {
      const form = new FormData();
      if (!replacing) form.set("label", label);
      if (file) form.set("file", file);
      if (fileName.trim()) form.set("fileName", fileName);
      const url = replacing ? `/api/resumes/${replacing.id}/replace` : "/api/resumes";
      const resume = await apiRequest<Resume>(url, { method: "POST", body: form });
      onUploaded(resume);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.body.fields) {
        const fields = err.body.fields;
        setLabelError(fields.label);
        setFileError(fields.file);
      } else if (err instanceof ApiError && err.status === 409 && err.body.error === "label_taken") {
        setLabelError(`You already have a resume labeled "${label.trim()}".`);
      } else if (err instanceof ApiError && err.status === 409 && err.body.error === "resume_limit_reached") {
        setFileError("You've reached the limit of 20 saved resumes. Remove one and try again.");
      } else if (err instanceof ApiError && err.status === 404) {
        setFileError("That resume no longer exists.");
      } else {
        setFileError("Something went wrong. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void upload();
      }}
    >
      <VStack gap={4}>
        {!replacing && (
          <TextInput
            label="Label"
            value={label}
            onChange={(v) => {
              setLabel(v);
              if (labelError) setLabelError(undefined);
            }}
            placeholder='e.g. "Backend Engineer"'
            isRequired
            hasAutoFocus
            status={labelError ? { type: "error", message: labelError } : undefined}
          />
        )}
        <FileInput
          label="Resume PDF"
          mode="dropzone"
          accept="application/pdf,.pdf"
          value={file}
          onChange={(f) => {
            const next = Array.isArray(f) ? (f[0] ?? null) : f;
            if (next && next.size > MAX_FILE_SIZE) {
              setFile(null);
              setFileError(
                `That file is ${(next.size / (1024 * 1024)).toFixed(1)} MB. Resumes must be under ${MAX_FILE_MB} MB. Try compressing the PDF or exporting a smaller one.`,
              );
              return;
            }
            setFile(next);
            if (fileError) setFileError(undefined);
          }}
          description={`PDF, up to ${MAX_FILE_MB}MB.`}
          isRequired
          status={fileError ? { type: "error", message: fileError } : undefined}
        />
        <TextInput
          label="File name"
          value={fileName}
          onChange={setFileName}
          placeholder="e.g. Varun Mhatre - Backend Engineer.pdf"
          description="Optional. This is the name recipients see when the resume is emailed. Leave blank to use the uploaded file's own name."
        />
        <HStack justify="end" gap={2}>
          <Button label="Cancel" variant="ghost" onClick={onCancel} isDisabled={isUploading} />
          <Button label={replacing ? "Update" : "Upload"} variant="primary" type="submit" isLoading={isUploading} />
        </HStack>
      </VStack>
    </form>
  );
}
