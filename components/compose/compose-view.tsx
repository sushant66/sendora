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
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Contact, ContactList } from "@/lib/contacts/types";
import type { Template, TemplatePreview } from "@/lib/templates/types";
import type { AccountStatus } from "@/lib/email/types";
import type { SendResultItem, SendSummary } from "@/lib/send/types";
import type { RecontactInfo } from "@/lib/history/types";
import { RichTextEditor } from "@/components/rich-text-editor/rich-text-editor";
import { EmailPreview } from "./email-preview";

const PREVIEW_DEBOUNCE_MS = 350;

export function ComposeView() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [contactIds, setContactIds] = useState<string[]>([]);
  const [previewFor, setPreviewFor] = useState<string>("");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [recontact, setRecontact] = useState<RecontactInfo | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<SendSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, t, a] = await Promise.all([
          apiRequest<ContactList>("/api/contacts"),
          apiRequest<{ items: Template[] }>("/api/templates"),
          apiRequest<AccountStatus>("/api/email-account"),
        ]);
        setContacts(c.items);
        setTemplates(t.items);
        setAccount(a);
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

  const contactsById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  // The recipient the live preview renders for: the chosen one if still selected, else the first.
  const previewContactId = contactIds.includes(previewFor) ? previewFor : contactIds[0] ?? "";
  const previewContact = contactsById.get(previewContactId);
  const hasContent = subject.trim().length > 0 && bodyHtml.replace(/<[^>]*>/g, "").trim().length > 0;

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
        const info = await apiRequest<RecontactInfo>(`/api/history/recontact?contactIds=${contactIds.map(encodeURIComponent).join(",")}`);
        if (!cancelled) setRecontact(info);
      } catch {
        /* leave prior info; render filters by current selection */
      }
    })();
    return () => { cancelled = true; };
  }, [contactIds]);

  const alreadyContacted = (recontact?.previouslyContacted ?? []).filter((p) => contactIds.includes(p.contactId));

  const canSend = contactIds.length > 0 && hasContent && account?.connected === true && !isSending;
  const isBulk = contactIds.length > 1;

  async function send() {
    setIsSending(true);
    setResult(null);
    try {
      const summary = await apiRequest<SendSummary>("/api/send", {
        method: "POST",
        json: { contactIds, templateId: templateId || undefined, override: { subject, bodyHtml } },
      });
      setResult(summary);
      if (summary.failed === 0) toast({ body: `Sent to ${summary.sent} recruiter${summary.sent === 1 ? "" : "s"}.` });
      else if (summary.sent > 0) toast({ body: `Sent ${summary.sent}, ${summary.failed} failed.`, type: "error" });
      else toast({ body: "No emails were sent.", type: "error" });
    } catch (err) {
      if (err instanceof ApiError && err.body.error === "no_active_account") {
        setAccount({ connected: false });
        toast({ body: "Connect your Gmail before sending.", type: "error" });
      } else if (err instanceof ApiError && err.status === 422) {
        toast({ body: "Add recipients, a subject, and a body before sending.", type: "error" });
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
      <EmptyState
        title="Add a recruiter first"
        description="Compose needs at least one contact. Import a list or add one, then come back to send."
        actions={<Button as={Link} href="/contacts" label="Go to contacts" variant="primary" />}
      />
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
          <MultiSelector
            label="Recipients"
            isRequired
            hasSearch
            hasClear
            placeholder="Choose one or more recruiters"
            options={contacts.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))}
            value={contactIds}
            onChange={setContactIds}
          />
          <Selector
            label="Template"
            hasSearch
            placeholder="Start from a template (optional)"
            options={templates.map((t) => ({ value: t.id, label: t.kind === "system" ? `${t.name} (starter)` : t.name }))}
            value={templateId}
            onChange={onTemplate}
          />
          <TextInput label="Subject" value={subject} onChange={setSubject} placeholder="Subject line" />
          <RichTextEditor key={templateId || "blank"} label="Body" value={bodyHtml} onChange={setBodyHtml} />
          <HStack justify="between" align="center" gap={3}>
            <Text color="secondary" size="sm">
              {contactIds.length === 0
                ? "No recipients selected"
                : isBulk
                  ? `${contactIds.length} recruiters, each gets a separate, personalized email`
                  : "1 recruiter"}
            </Text>
            <Button
              label={isBulk ? `Send ${contactIds.length} emails` : "Send email"}
              variant="primary"
              onClick={send}
              isLoading={isSending}
              isDisabled={!canSend}
              tooltip={account?.connected ? undefined : "Connect your Gmail to send"}
            />
          </HStack>
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
          />
        </VStack>
      </Grid>
    </VStack>
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
