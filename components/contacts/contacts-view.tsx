"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Table, proportional, pixel, type TableColumn } from "@astryxdesign/core/Table";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Contact, ContactList } from "@/lib/contacts/types";
import { ContactFormDialog } from "./contact-form-dialog";

const SEARCH_DEBOUNCE_MS = 250;

export function ContactsView() {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>(undefined);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track the latest search so out-of-order responses don't clobber newer results.
  const searchSeq = useRef(0);

  const load = useCallback(async (q: string) => {
    const seq = ++searchSeq.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("query", q.trim());
      const data = await apiRequest<ContactList>(`/api/contacts?${params}`);
      if (seq !== searchSeq.current) return; // a newer search superseded this one
      setContacts(data.items);
      setNextCursor(data.nextCursor);
    } catch {
      if (seq === searchSeq.current) toast({ body: "Couldn't load contacts.", type: "error" });
    } finally {
      if (seq === searchSeq.current) setIsLoading(false);
    }
  }, [toast]);

  // Debounced search whenever the query changes (also the initial load).
  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      if (query.trim()) params.set("query", query.trim());
      const data = await apiRequest<ContactList>(`/api/contacts?${params}`);
      setContacts((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      toast({ body: "Couldn't load more contacts.", type: "error" });
    } finally {
      setIsLoadingMore(false);
    }
  }

  function onSaved(saved: Contact, mode: "created" | "updated") {
    setContacts((prev) =>
      mode === "updated" ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev],
    );
    toast({ body: mode === "created" ? `Added ${saved.name}.` : `Updated ${saved.name}.` });
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/contacts/${deleting.id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c.id !== deleting.id));
      toast({ body: `Deleted ${deleting.name}.` });
      setDeleting(null);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 404 ? "That contact no longer exists." : "Couldn't delete the contact.";
      toast({ body: msg, type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: TableColumn<Contact>[] = [
    { key: "name", header: "Name", width: proportional(1.5) },
    {
      key: "email",
      header: "Email",
      width: proportional(2),
      renderCell: (row) => <Link href={`mailto:${row.email}`}>{row.email}</Link>,
    },
    { key: "company", header: "Company", width: proportional(1.5), renderCell: (row) => row.company ?? "—" },
    { key: "role", header: "Role", width: proportional(1.5), renderCell: (row) => row.role ?? "—" },
    {
      key: "actions",
      header: "",
      width: pixel(72),
      align: "end",
      renderCell: (row) => (
        <MoreMenu
          label={`Actions for ${row.name}`}
          size="sm"
          items={[
            { label: "Edit", onClick: () => { setEditing(row); setFormOpen(true); } },
            { type: "divider" },
            { label: "Delete", onClick: () => setDeleting(row) },
          ]}
        />
      ),
    },
  ];

  const hasSearch = query.trim().length > 0;

  return (
    <VStack gap={5}>
      <HStack justify="between" align="center" gap={4}>
        <VStack gap={1}>
          <Heading level={1}>Contacts</Heading>
          <Text color="secondary">Recruiters you can reach out to.</Text>
        </VStack>
        <HStack gap={2}>
          <Button as={Link} href="/contacts/import" label="Import" variant="secondary" />
          <Button label="Add contact" variant="primary" onClick={() => { setEditing(undefined); setFormOpen(true); }} />
        </HStack>
      </HStack>

      <VStack gap={8}>
        <TextInput
          label="Search contacts"
          isLabelHidden
          placeholder="Search by name, email, or company"
          startIcon="search"
          hasClear
          value={query}
          onChange={setQuery}
          size="lg"
        />

        {isLoading ? (
          <TableSkeleton columns={[1.5, 2, 1.5, 1.5, { px: 72 }]} rows={5} />
        ) : contacts.length === 0 ? (
          hasSearch ? (
            <EmptyState
              icon={<SearchGlyph />}
              title={`No contacts match "${query.trim()}"`}
              description="Try a different name, email, or company."
              actions={<Button label="Clear search" variant="secondary" onClick={() => setQuery("")} />}
            />
          ) : (
            <EmptyState
              icon={<PeopleGlyph />}
              title="No contacts yet"
              description="Import recruiters from a CSV or Excel file, paste a list, or add one by hand to get started."
              actions={
                <HStack gap={2}>
                  <Button as={Link} href="/contacts/import" label="Import contacts" variant="primary" />
                  <Button label="Add manually" variant="secondary" onClick={() => { setEditing(undefined); setFormOpen(true); }} />
                </HStack>
              }
            />
          )
        ) : (
          <VStack gap={3}>
            <Table
              data={contacts}
              columns={columns}
              idKey="id"
              density="compact"
              dividers="rows"
              hasHover
              textOverflow="truncate"
            />
            {nextCursor && (
              <HStack justify="center">
                <Button label="Load more" variant="ghost" onClick={loadMore} isLoading={isLoadingMore} />
              </HStack>
            )}
          </VStack>
        )}
      </VStack>

      <ContactFormDialog isOpen={formOpen} onOpenChange={setFormOpen} contact={editing} onSaved={onSaved} />
      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete contact?"
        description={deleting ? `${deleting.name} (${deleting.email}) will be removed. This can't be undone.` : ""}
        actionLabel="Delete"
        onAction={confirmDelete}
        isActionLoading={isDeleting}
      />
    </VStack>
  );
}

function SearchGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

function PeopleGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2.5-4.6" />
    </svg>
  );
}
