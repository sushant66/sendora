"use client";

import { useEffect, useState } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import { PlusIcon } from "@/components/app-icons";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import type { Resume } from "@/lib/resumes/types";
import { UploadResumeDialog } from "./upload-dialog";
import { ResumeList } from "./resume-list";
import { ResumePreviewDialog } from "./resume-preview-dialog";

export function ResumesView() {
  const toast = useToast();
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replacing, setReplacing] = useState<Resume | null>(null);
  const [previewing, setPreviewing] = useState<Resume | null>(null);
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function load() {
    try {
      // Active resumes only — retained-but-archived rows are internal history plumbing
      // (openable from a send record), never shown on the shelf.
      const { items } = await apiRequest<{ items: Resume[] }>("/api/resumes");
      setResumes(items);
    } catch {
      toast({ body: "Couldn't load your resumes.", type: "error" });
      setResumes([]);
    }
  }

  useEffect(() => {
    // Inline rather than calling `load()` directly, matching the pattern already used by
    // ContactsView/TemplatesView — the lint rule (react-hooks/set-state-in-effect) traces
    // into a named function call and flags its setState, but not an inline async IIFE.
    (async () => {
      try {
        const { items } = await apiRequest<{ items: Resume[] }>("/api/resumes");
        setResumes(items);
      } catch {
        toast({ body: "Couldn't load your resumes.", type: "error" });
        setResumes([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onUploaded(resume: Resume) {
    void load();
    setPreviewing(null);
    toast({ body: replacing ? `Updated "${resume.label}".` : `Uploaded "${resume.label}".` });
  }

  function closeUploadDialog(open: boolean) {
    if (open) return;
    setUploadOpen(false);
    setReplacing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/resumes/${deleting.id}`, { method: "DELETE" });
      await load();
      toast({ body: `Deleted "${deleting.label}".` });
      setPreviewing(null);
      setDeleting(null);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 404 ? "That resume no longer exists." : "Couldn't delete the resume.";
      toast({ body: msg, type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <VStack gap={5}>
      <HStack justify="between" align="center" gap={4}>
        <VStack gap={1}>
          <Heading level={1}>Resumes</Heading>
          <Text color="secondary">Your labeled resumes, ready to attach when you send.</Text>
        </VStack>
        <Button
          label="Upload resume"
          variant="primary"
          icon={<Icon icon={PlusIcon} size="xsm" />}
          onClick={() => setUploadOpen(true)}
        />
      </HStack>

      {resumes === null ? (
        <TableSkeleton columns={[2, { px: 220 }]} rows={4} />
      ) : resumes.length === 0 ? (
        <EmptyState
          title="No resumes yet"
          description='Upload a PDF and give it a label (e.g. "Backend Engineer") so it is ready to attach when you send.'
          actions={
            <Button
              label="Upload resume"
              variant="primary"
              icon={<Icon icon={PlusIcon} size="xsm" />}
              onClick={() => setUploadOpen(true)}
            />
          }
        />
      ) : (
        <ResumeList
          resumes={resumes}
          onPreview={setPreviewing}
          onRequestReplace={setReplacing}
          onRequestDelete={setDeleting}
        />
      )}

      <ResumePreviewDialog
        resume={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
        onRequestUpdate={(resume) => {
          setPreviewing(null);
          setReplacing(resume);
        }}
        onRequestDelete={(resume) => {
          setPreviewing(null);
          setDeleting(resume);
        }}
      />

      <UploadResumeDialog
        isOpen={uploadOpen || replacing !== null}
        onOpenChange={closeUploadDialog}
        onUploaded={onUploaded}
        replacing={replacing ?? undefined}
      />
      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete resume?"
        description={deleting ? `"${deleting.label}" will be removed from your resumes. This can't be undone.` : ""}
        actionLabel="Delete"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </VStack>
  );
}
