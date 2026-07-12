"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { MultiSelector } from "@astryxdesign/core/MultiSelector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Table, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Contact, ContactList } from "@/lib/contacts/types";
import type { Template, TemplatePreview } from "@/lib/templates/types";
import type { AccountStatus } from "@/lib/email/types";
import type { SendResultItem, SendSummary } from "@/lib/send/types";
import { MAX_SEND_RECIPIENTS } from "@/lib/validation/send";
import type { RecontactInfo } from "@/lib/history/types";
import type { Resume } from "@/lib/resumes/types";
import type { SenderProfile } from "@/lib/profile/types";
import { computeMissingValues, type MissingValueReport } from "@/lib/compose/missing-values";
import { MERGE_FIELD_BY_TOKEN } from "@/lib/templates/fields";
import { RichTextEditor } from "@/components/rich-text-editor/rich-text-editor";
import { InsertFieldMenu } from "@/components/rich-text-editor/insert-field-menu";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { PlusIcon } from "@/components/app-icons";
import { takePreselect } from "@/lib/compose/preselect";
import { EmailPreview } from "./email-preview";

type TestSendResult = { status: "sent" | "failed"; toEmail?: string; reason?: string };

const PREVIEW_DEBOUNCE_MS = 350;

export function ComposeView({ senderName = null }: { senderName?: string | null }) {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [contactIds, setContactIds] = useState<string[]>([]);
  const subjectRef = useRef<HTMLElement | null>(null);
  const [previewFor, setPreviewFor] = useState<string>("");
  const [templateId, setTemplateId] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [recontact, setRecontact] = useState<RecontactInfo | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SendSummary | null>(null);
  const [profile, setProfile] = useState<SenderProfile | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  // Pre-send missing-value gate (FR-016): populated when a send would leave a used field blank.
  const [gate, setGate] = useState<{ report: MissingValueReport; preview: TemplatePreview | null } | null>(null);
  // Quick "email a recruiter you just got" flow: add a recipient inline without a detour to Contacts.
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, t, a, r, p] = await Promise.all([
          apiRequest<ContactList>("/api/contacts?all=1"),
          apiRequest<{ items: Template[] }>("/api/templates"),
          apiRequest<AccountStatus>("/api/email-account"),
          apiRequest<{ items: Resume[] }>("/api/resumes"),
          apiRequest<SenderProfile>("/api/profile"),
        ]);
        setContacts(c.items);
        setTemplates(t.items);
        setAccount(a);
        setResumes(r.items);
        setProfile(p);

        // Pick up a batch handed off from the import screen and pre-fill the recipients, so the
        // user doesn't re-select the list they just imported. Keep only IDs that still exist,
        // and say so honestly if any were dropped (e.g. deleted between import and here).
        const preselect = takePreselect();
        if (preselect.length > 0) {
          const known = new Set(c.items.map((x) => x.id));
          const valid = preselect.filter((id) => known.has(id));
          const dropped = preselect.length - valid.length;
          if (valid.length > 0) {
            setContactIds(valid);
            toast({
              body:
                dropped > 0
                  ? `Added ${valid.length} of ${preselect.length} imported recruiters. ${dropped} could not be found.`
                  : `Added ${valid.length} recruiter${valid.length === 1 ? "" : "s"} from your import.`,
              type: dropped > 0 ? "error" : undefined,
            });
          } else {
            // Every handed-off contact vanished before we got here (e.g. deleted). Don't leave
            // the user staring at a blank recipient field wondering why nothing was selected.
            toast({ body: "Those recruiters could not be found. They may have been deleted.", type: "error" });
          }
        }
      } catch {
        toast({ body: "Couldn't load compose data.", type: "error" });
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setBodyHtml(t.bodyHtml);
    }
  }

  // A recruiter added from inside compose joins the picker and is selected into the send at once,
  // so the user goes straight from "I just got their email" to sending, with no trip to Contacts.
  function onRecruiterAdded(contact: Contact) {
    setContacts((prev) => (prev.some((c) => c.id === contact.id) ? prev : [contact, ...prev]));
    setContactIds((prev) => (prev.includes(contact.id) ? prev : [...prev, contact.id]));
    toast({ body: `Added ${contact.name}.` });
  }

  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  // The recipient the live preview renders for: the chosen one if still selected, else the first.
  const previewContactId = contactIds.includes(previewFor) ? previewFor : contactIds[0] ?? "";
  const previewContact = contactsById.get(previewContactId);
  const hasContent = subject.trim().length > 0 && bodyHtml.replace(/<[^>]*>/g, "").trim().length > 0;
  const attachedResume = resumes.find((r) => r.id === resumeId) ?? null;

  // Guards against out-of-order preview responses clobbering a newer request.
  const previewSeq = useRef(0);
  const runPreview = useCallback(async (cid: string, subj: string, html: string) => {
    const seq = ++previewSeq.current;
    if (!cid || !subj.trim() || !html.trim()) {
      setPreview(null);
      return;
    }
    try {
      const p = await apiRequest<TemplatePreview>("/api/templates/preview", {
        method: "POST",
        json: { contactId: cid, inline: { subject: subj, bodyHtml: html } },
      });
      if (seq === previewSeq.current) setPreview(p);
    } catch {
      if (seq === previewSeq.current) setPreview(null);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runPreview(previewContactId, subject, bodyHtml), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [previewContactId, subject, bodyHtml, runPreview]);

  // Re-contact warning (FR-021): flag any selected recruiter already emailed before.
  // Stale results are harmless — `alreadyContacted` filters to the current selection.
  useEffect(() => {
    if (contactIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await apiRequest<RecontactInfo>("/api/history/recontact", {
          method: "POST",
          json: { contactIds },
        });
        if (!cancelled) setRecontact(info);
      } catch {
        /* leave prior info; render filters by current selection */
      }
    })();
    return () => { cancelled = true; };
  }, [contactIds]);

  const alreadyContacted = (recontact?.previouslyContacted ?? []).filter((p) => contactIds.includes(p.contactId));

  // Select-all makes it easy to pick more than a single send allows (FR / SendRequestSchema cap),
  // so guard it here with clear feedback instead of letting the send fail server-side.
  const overRecipientLimit = contactIds.length > MAX_SEND_RECIPIENTS;
  const canSend = contactIds.length > 0 && hasContent && account?.connected === true && !isSending && !overRecipientLimit;
  const isBulk = contactIds.length > 1;

  const selectedContacts = useMemo(
    () => contactIds.map((id) => contactsById.get(id)).filter((c): c is Contact => Boolean(c)),
    [contactIds, contactsById],
  );

  /** Send-time gate (FR-016): if a used field would resolve empty, show how it reads and
   *  require an explicit confirm; otherwise send straight through. */
  async function attemptSend() {
    const report = computeMissingValues({ subject, bodyHtml, contacts: selectedContacts, profile, accountName: senderName });
    if (!report.hasMissing) {
      void send();
      return;
    }
    let representative: TemplatePreview | null = null;
    if (report.representativeContactId) {
      try {
        representative = await apiRequest<TemplatePreview>("/api/templates/preview", {
          method: "POST",
          json: { contactId: report.representativeContactId, inline: { subject, bodyHtml } },
        });
      } catch {
        /* the summary alone still lets the user decide */
      }
    }
    setGate({ report, preview: representative });
  }

  async function sendTest() {
    setIsTesting(true);
    try {
      const res = await apiRequest<TestSendResult>("/api/send/test", {
        method: "POST",
        json: {
          contactId: previewContactId || undefined,
          templateId: templateId || undefined,
          override: { subject, bodyHtml },
        },
      });
      if (res.status === "sent") toast({ body: `Test sent to ${res.toEmail}. Check your inbox.` });
      else toast({ body: res.reason ?? "The test could not be sent.", type: "error" });
    } catch (err) {
      if (err instanceof ApiError && err.body.error === "no_active_account") {
        setAccount({ connected: false });
        toast({ body: "Connect your Gmail to send a test.", type: "error" });
      } else if (err instanceof ApiError && err.status === 422) {
        const fieldMsg = err.body.fields ? Object.values(err.body.fields)[0] : undefined;
        toast({ body: fieldMsg ?? "Add a subject and body first.", type: "error" });
      } else {
        toast({ body: "Something went wrong sending the test.", type: "error" });
      }
    } finally {
      setIsTesting(false);
    }
  }

  async function send() {
    setGate(null);
    setIsSending(true);
    setResult(null);
    try {
      const summary = await apiRequest<SendSummary>("/api/send", {
        method: "POST",
        json: { contactIds, templateId: templateId || undefined, override: { subject, bodyHtml }, resumeId: resumeId || undefined },
      });
      setResult(summary);
      if (summary.failed === 0) toast({ body: `Sent to ${summary.sent} recruiter${summary.sent === 1 ? "" : "s"}.` });
      else if (summary.sent > 0) toast({ body: `Sent ${summary.sent}, ${summary.failed} failed.`, type: "error" });
      else toast({ body: "No emails were sent.", type: "error" });
    } catch (err) {
      if (err instanceof ApiError && err.body.error === "no_active_account") {
        setAccount({ connected: false });
        toast({ body: "Connect your Gmail before sending.", type: "error" });
      } else if (err instanceof ApiError && err.body.error === "resume_unavailable") {
        setResumeId("");
        toast({ body: "That resume is no longer available. Pick another.", type: "error" });
      } else if (err instanceof ApiError && err.body.error === "attachment_too_large") {
        toast({ body: "That resume is too large to attach to this email. Try a smaller file.", type: "error" });
      } else if (err instanceof ApiError && err.status === 404) {
        setResumeId("");
        toast({ body: "That resume could not be found. Pick another.", type: "error" });
      } else if (err instanceof ApiError && err.status === 422) {
        const fieldMsg = err.body.fields ? Object.values(err.body.fields)[0] : undefined;
        toast({ body: fieldMsg ?? "Add recipients, a subject, and a body before sending.", type: "error" });
      } else {
        toast({ body: "Something went wrong sending.", type: "error" });
      }
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <VStack gap={5}>
        <VStack gap={1} align="stretch">
          <Skeleton height={28} width={150} radius={2} />
          <Skeleton height={16} width={440} radius={2} />
        </VStack>
        <Grid columns={{ minWidth: 360 }} gap={5}>
          <VStack gap={4} align="stretch">
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton />
            <FieldSkeleton controlHeight={180} />
            <HStack justify="between" align="center">
              <Skeleton height={14} width={150} radius={2} />
              <Skeleton height={40} width={120} radius={2} />
            </HStack>
          </VStack>
          <Skeleton height={320} radius={3} />
        </Grid>
      </VStack>
    );
  }

  if (contacts.length === 0) {
    return (
      <>
        <EmptyState
          title="Add your first recruiter"
          description="Add a recruiter to send to right here, or import a whole list from Contacts."
          actions={
            <HStack gap={2}>
              <Button label="Add a recruiter" variant="primary" onClick={() => setAddOpen(true)} />
              <Button as={Link} href="/contacts" label="Import a list" variant="secondary" />
            </HStack>
          }
        />
        <ContactFormDialog isOpen={addOpen} onOpenChange={setAddOpen} onSaved={onRecruiterAdded} />
      </>
    );
  }

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={1}>Compose</Heading>
        <Text color="secondary">Pick recruiters and a template, personalize it, and send individually from your inbox.</Text>
      </VStack>

      {account && !account.connected && (
        <Banner
          status="warning"
          container="section"
          title="Connect your Gmail to send"
          description="Outreach sends from your own inbox. Connect Gmail to enable sending."
          endContent={<Button as={Link} href="/settings/email-account" label="Connect Gmail" variant="primary" />}
        />
      )}

      {alreadyContacted.length > 0 && !result && (
        <Banner
          status="warning"
          container="section"
          title={
            alreadyContacted.length === 1
              ? "You've already emailed this recruiter"
              : `You've already emailed ${alreadyContacted.length} of these recruiters`
          }
          description={alreadyContacted
            .map((p) => {
              const name = contactsById.get(p.contactId)?.name ?? "A recruiter";
              return `${name} (last on ${new Date(p.lastSentAt).toLocaleDateString()})`;
            })
            .join("; ")}
        />
      )}

      {result && <SendResultPanel result={result} contactsById={contactsById} />}

      <Grid columns={{ minWidth: 360 }} gap={5}>
        <VStack gap={4} align="stretch">
          <VStack gap={1} align="stretch">
            <HStack justify="between" align="center">
              <HStack gap={1} align="center">
                <Text size="sm" weight="medium">Recipients</Text>
                <Text size="sm" color="secondary">· Required</Text>
              </HStack>
              <Button
                label="New recruiter"
                icon={<PlusIcon width={16} height={16} />}
                variant="secondary"
                size="sm"
                onClick={() => setAddOpen(true)}
                tooltip="Add a recruiter who isn't in your list yet"
              />
            </HStack>
            <MultiSelector
              label="Recipients"
              isLabelHidden
              isRequired
              hasSearch
              hasClear
              hasSelectAll
              placeholder="Choose one or more recruiters"
              options={contacts.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))}
              value={contactIds}
              onChange={setContactIds}
            />
          </VStack>
          <Selector
            label="Template"
            hasSearch
            placeholder="Start from a template (optional)"
            options={templates.map((t) => ({ value: t.id, label: t.kind === "system" ? `${t.name} (starter)` : t.name }))}
            value={templateId}
            onChange={onTemplate}
          />
          <Selector
            label="Resume"
            hasSearch
            placeholder="No attachment (optional)"
            options={resumes.map((r) => ({ value: r.id, label: `${r.label} (${r.fileName})` }))}
            value={resumeId}
            onChange={setResumeId}
          />
          <VStack gap={1} align="stretch">
            <HStack justify="between" align="center">
              <Text size="sm" weight="medium">Subject</Text>
              <InsertFieldMenu value={subject} onChange={setSubject} containerRef={subjectRef} />
            </HStack>
            <span ref={subjectRef} style={{ display: "contents" }}>
              <TextInput label="Subject" isLabelHidden value={subject} onChange={setSubject} placeholder="Subject line" />
            </span>
          </VStack>
          <RichTextEditor key={templateId || "blank"} label="Body" value={bodyHtml} onChange={setBodyHtml} />
          <HStack justify="between" align="center" gap={3}>
            <Text color={overRecipientLimit ? "primary" : "secondary"} size="sm">
              {contactIds.length === 0
                ? "No recipients selected"
                : overRecipientLimit
                  ? `Too many recipients. Send to up to ${MAX_SEND_RECIPIENTS} at once (remove ${(contactIds.length - MAX_SEND_RECIPIENTS).toLocaleString()}).`
                  : isBulk
                    ? `${contactIds.length} recruiters, each gets a separate, personalized email`
                    : "1 recruiter"}
            </Text>
            <HStack gap={2} align="center">
              <Button
                label="Send test to myself"
                variant="secondary"
                onClick={sendTest}
                isLoading={isTesting}
                isDisabled={!hasContent || account?.connected !== true || isSending}
                tooltip={
                  !account?.connected
                    ? "Connect your Gmail to send a test"
                    : !hasContent
                      ? "Add a subject and body first"
                      : "Send this draft to your own inbox"
                }
              />
              <Button
                label={isBulk ? `Send ${contactIds.length} emails` : "Send email"}
                variant="primary"
                onClick={attemptSend}
                isLoading={isSending}
                isDisabled={!canSend}
                tooltip={
                  !account?.connected
                    ? "Connect your Gmail to send"
                    : overRecipientLimit
                      ? `Remove ${(contactIds.length - MAX_SEND_RECIPIENTS).toLocaleString()} recipients to send`
                      : undefined
                }
              />
            </HStack>
          </HStack>
          {gate && (
            <MissingValueGate
              report={gate.report}
              preview={gate.preview}
              fromEmail={account?.emailAddress}
              toEmail={contactsById.get(gate.report.representativeContactId ?? "")?.email}
              onCancel={() => setGate(null)}
              onConfirm={() => void send()}
              isSending={isSending}
            />
          )}
        </VStack>

        <VStack gap={3} align="stretch">
          {isBulk && (
            <Selector
              label="Preview for"
              options={contactIds.map((id) => ({ value: id, label: contactsById.get(id)?.name ?? id }))}
              value={previewContactId}
              onChange={setPreviewFor}
            />
          )}
          <EmailPreview
            preview={preview}
            fromEmail={account?.emailAddress}
            toEmail={previewContact?.email}
            isEmpty={contactIds.length === 0 || !hasContent}
            attachedResume={attachedResume ? { label: attachedResume.label, fileName: attachedResume.fileName } : null}
            canCopy
          />
        </VStack>
      </Grid>

      <ContactFormDialog isOpen={addOpen} onOpenChange={setAddOpen} onSaved={onRecruiterAdded} />
    </VStack>
  );
}

function labelsFor(tokens: string[]): string {
  return tokens.map((t) => MERGE_FIELD_BY_TOKEN[t]?.label ?? t).join(", ");
}

/**
 * Pre-send missing-value gate (US3, FR-016). Summarizes which used fields would be left blank,
 * shows how a representative affected email actually reads, and requires an explicit confirm.
 * Warn-and-confirm, never a hard block.
 */
function MissingValueGate({
  report,
  preview,
  fromEmail,
  toEmail,
  onCancel,
  onConfirm,
  isSending,
}: {
  report: MissingValueReport;
  preview: TemplatePreview | null;
  fromEmail?: string;
  toEmail?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isSending: boolean;
}) {
  const recipientMissingTokens = [...new Set(report.affected.flatMap((a) => a.missing))];
  return (
    <Dialog isOpen onOpenChange={(open) => !open && onCancel()} purpose="required" width={560} maxHeight="85vh">
      <DialogHeader
        title="Some fields will be left blank"
        subtitle="These emails will still send. Here is how one of them reads so you can decide."
      />
      <VStack gap={4} align="stretch">
        <VStack gap={2} align="stretch">
          {recipientMissingTokens.length > 0 && (
            <Banner
              status="warning"
              container="card"
              title={`${report.affected.length} recipient${report.affected.length === 1 ? "" : "s"} missing a value`}
              description={`No value for ${labelsFor(recipientMissingTokens)} on ${report.affected.length === 1 ? "this recipient" : "these recipients"}.`}
            />
          )}
          {report.senderMissing.length > 0 && (
            <Banner
              status="warning"
              container="card"
              title="Your profile is missing a value"
              description={`${labelsFor(report.senderMissing)} ${report.senderMissing.length === 1 ? "is" : "are"} empty, so ${report.senderMissing.length === 1 ? "it" : "they"} will be blank in every email. You can add ${report.senderMissing.length === 1 ? "it" : "them"} on your profile.`}
            />
          )}
        </VStack>

        <VStack gap={2} align="stretch">
          <Text size="sm" weight="medium">
            How one of these emails reads
          </Text>
          <EmailPreview preview={preview} fromEmail={fromEmail} toEmail={toEmail} isEmpty={!preview} hideWarnings />
        </VStack>

        <HStack justify="end" gap={2}>
          <Button label="Go back and edit" variant="ghost" onClick={onCancel} isDisabled={isSending} />
          <Button label="Send anyway" variant="primary" onClick={onConfirm} isLoading={isSending} />
        </HStack>
      </VStack>
    </Dialog>
  );
}

// A labelled form control while loading: a short label bar over a control-height block.
function FieldSkeleton({ controlHeight = 40 }: { controlHeight?: number }) {
  return (
    <VStack gap={1} align="stretch">
      <Skeleton height={12} width={90} radius={2} />
      <Skeleton height={controlHeight} radius={2} />
    </VStack>
  );
}

function SendResultPanel({
  result,
  contactsById,
}: {
  result: SendSummary;
  contactsById: Map<string, Contact>;
}) {
  const allSent = result.failed === 0;
  const columns: TableColumn<SendResultItem>[] = [
    {
      key: "recipient",
      header: "Recipient",
      width: proportional(2),
      renderCell: (r) => (
        <Text>{contactsById.get(r.contactId)?.name ?? r.recipientEmail}</Text>
      ),
    },
    { key: "email", header: "Email", width: proportional(2), renderCell: (r) => <Text color="secondary">{r.recipientEmail}</Text> },
    {
      key: "status",
      header: "Result",
      width: proportional(1.5),
      renderCell: (r) => (
        <HStack gap={2} align="center">
          <StatusDot variant={r.status === "sent" ? "success" : "error"} label={r.status} />
          <Text size="sm" color="secondary">{r.status === "sent" ? "Sent" : r.reason ?? "Failed"}</Text>
        </HStack>
      ),
    },
  ];

  return (
    // Constrained so the confirmation reads as a composed summary, not a full-width green
    // slab with the action stranded far right across an empty expanse.
    <VStack gap={3} align="stretch" style={{ maxWidth: 640 }}>
      <Banner
        status={allSent ? "success" : result.sent > 0 ? "warning" : "error"}
        container="card"
        title={
          allSent
            ? `Sent to ${result.sent} recruiter${result.sent === 1 ? "" : "s"}`
            : `Sent ${result.sent} of ${result.total}, ${result.failed} failed`
        }
        description={allSent ? "Each recruiter received their own personalized email." : "Successful sends were kept; failed ones are listed below."}
        endContent={<Button as={Link} href="/history" label="View history" variant="secondary" />}
      />
      {result.total > 1 && (
        <Table data={result.results} columns={columns} idKey="contactId" density="compact" dividers="rows" />
      )}
    </VStack>
  );
}
