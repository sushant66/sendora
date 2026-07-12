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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (FR-003)

export function UploadResumeDialog({
  isOpen,
  onOpenChange,
  onUploaded,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (resume: Resume) => void;
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
      <DialogHeader title="Upload resume" />
      {/* Keyed so reopening the dialog remounts with fresh state. */}
      <UploadForm
        key={isOpen ? "open" : "closed"}
        onCancel={() => onOpenChange(false)}
        onUploaded={(resume) => {
          onUploaded(resume);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

function UploadForm({ onCancel, onUploaded }: { onCancel: () => void; onUploaded: (resume: Resume) => void }) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    setIsUploading(true);
    setLabelError(undefined);
    setFileError(undefined);
    try {
      const form = new FormData();
      form.set("label", label);
      if (file) form.set("file", file);
      const resume = await apiRequest<Resume>("/api/resumes", { method: "POST", body: form });
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
        <FileInput
          label="Resume PDF"
          mode="dropzone"
          accept="application/pdf,.pdf"
          maxSize={MAX_FILE_SIZE}
          value={file}
          onChange={(f) => {
            setFile(Array.isArray(f) ? (f[0] ?? null) : f);
            if (fileError) setFileError(undefined);
          }}
          description="PDF, up to 10MB."
          isRequired
          status={fileError ? { type: "error", message: fileError } : undefined}
        />
        <HStack justify="end" gap={2}>
          <Button label="Cancel" variant="ghost" onClick={onCancel} isDisabled={isUploading} />
          <Button label="Upload" variant="primary" type="submit" isLoading={isUploading} />
        </HStack>
      </VStack>
    </form>
  );
}
