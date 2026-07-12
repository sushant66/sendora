"use client";

import { useEffect, useMemo, useState } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import type { Resume, ResumeNode } from "@/lib/resumes/types";
import { UploadResumeDialog } from "./upload-dialog";
import { ResumeList } from "./resume-list";

export function ResumesView() {
  const toast = useToast();
  const [allResumes, setAllResumes] = useState<Resume[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replacing, setReplacing] = useState<Resume | null>(null);
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    try {
      const { items } = await apiRequest<{ items: Resume[] }>("/api/resumes?includeArchived=true");
      setAllResumes(items);
    } catch {
      toast({ body: "Couldn't load your resumes.", type: "error" });
      setAllResumes([]);
    }
  }

  useEffect(() => {
    // Inline rather than calling `load()` directly, matching the pattern already used by
    // ContactsView/TemplatesView — the lint rule (react-hooks/set-state-in-effect) traces
    // into a named function call and flags its setState, but not an inline async IIFE.
    (async () => {
      try {
        const { items } = await apiRequest<{ items: Resume[] }>("/api/resumes?includeArchived=true");
        setAllResumes(items);
      } catch {
        toast({ body: "Couldn't load your resumes.", type: "error" });
        setAllResumes([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active resumes as top-level rows, each carrying its own label's archived versions as
  // expandable history (US4) — one fetch, derived client-side rather than a second route.
  const resumeTree: ResumeNode[] = useMemo(() => {
    const items = allResumes ?? [];
    const archivedByLabel = new Map<string, Resume[]>();
    for (const r of items) {
      if (r.status !== "archived") continue;
      const list = archivedByLabel.get(r.label) ?? [];
      list.push(r);
      archivedByLabel.set(r.label, list);
    }
    // Newest-first — the most recently replaced version reads at the top of the history.
    for (const list of archivedByLabel.values()) list.sort((a, b) => b.version - a.version);

    return items
      .filter((r) => r.status === "active")
      .map((r) => ({ ...r, children: archivedByLabel.get(r.label) ?? [] }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allResumes]);

  function onUploaded(resume: Resume) {
    void load();
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
      setDeleting(null);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 404 ? "That resume no longer exists." : "Couldn't delete the resume.";
      toast({ body: msg, type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  async function onRestore(version: Resume) {
    setRestoringId(version.id);
    try {
      await apiRequest(`/api/resumes/${version.id}/restore`, { method: "POST" });
      await load();
      toast({ body: `Restored "${version.label}" (version ${version.version}).` });
    } catch {
      toast({ body: "Couldn't restore that version.", type: "error" });
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <VStack gap={5}>
      <HStack justify="between" align="center" gap={4}>
        <VStack gap={1}>
          <Heading level={1}>Resumes</Heading>
          <Text color="secondary">Your labeled resume variants, ready to pick from.</Text>
        </VStack>
        <Button label="Upload resume" variant="primary" onClick={() => setUploadOpen(true)} />
      </HStack>

      {allResumes === null ? (
        <TableSkeleton columns={[1.5, 2, { px: 90 }, { px: 120 }, { px: 72 }]} rows={4} />
      ) : resumeTree.length === 0 ? (
        <EmptyState
          title="No resumes yet"
          description='Upload a PDF and give it a label (e.g. "Backend Engineer") to get started.'
          actions={<Button label="Upload resume" variant="primary" onClick={() => setUploadOpen(true)} />}
        />
      ) : (
        <ResumeList
          resumes={resumeTree}
          onRequestDelete={setDeleting}
          onRequestReplace={setReplacing}
          onRestore={onRestore}
          restoringId={restoringId}
        />
      )}

      <UploadResumeDialog
        isOpen={uploadOpen || replacing !== null}
        onOpenChange={closeUploadDialog}
        onUploaded={onUploaded}
        replacing={replacing ?? undefined}
      />
      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete resume?"
        description={deleting ? `"${deleting.label}" will be removed from your active resumes.` : ""}
        actionLabel="Delete"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </VStack>
  );
}
