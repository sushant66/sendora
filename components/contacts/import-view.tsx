"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { TextArea } from "@astryxdesign/core/TextArea";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Banner } from "@astryxdesign/core/Banner";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { useToast } from "@astryxdesign/core/Toast";
import { parseCsv } from "@/lib/import/csv";
import { parseXlsx } from "@/lib/import/xlsx";
import { parsePaste } from "@/lib/import/paste";
import { applyMapping } from "@/lib/import/columns";
import type { ColumnMapping, ParseResult, RawImportRow } from "@/lib/import/types";
import { MAX_IMPORT_ROWS, type ImportSource } from "@/lib/validation/contacts";
import type { ImportResult } from "@/lib/contacts/types";
import { ApiError, apiRequest } from "@/lib/api/client";
import { stashPreselect } from "@/lib/compose/preselect";

type Method = "upload" | "paste";
type MappingField = keyof ColumnMapping;
const NONE = "__none__";

// Files are parsed entirely in the browser (only the parsed rows are POSTed), so a huge file
// would read gigabytes into the tab and crash it before anything useful happens. Cap the file
// size well above a legitimate contact list (5,000 rows is well under 1 MB) so oversized files
// fail fast with a clear message instead of freezing or crashing.
const MAX_IMPORT_FILE_MB = 10;
const MAX_IMPORT_FILE_BYTES = MAX_IMPORT_FILE_MB * 1024 * 1024;

export function ImportView() {
  const toast = useToast();
  const [method, setMethod] = useState<Method>("upload");
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [source, setSource] = useState<ImportSource>("csv");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function acceptParse(pr: ParseResult, src: ImportSource) {
    setParseError(null);
    setResult(null);
    if (pr.rows.length === 0) {
      setParsed(null);
      setParseError("No rows found. Check that the file/text has a header row and at least one data row.");
      return;
    }
    if (pr.rows.length > MAX_IMPORT_ROWS) {
      // Stop here rather than parse-then-POST-then-reject: the whole import would fail the
      // server's row cap anyway, so give instant, specific feedback instead of a round-trip error.
      setParsed(null);
      setParseError(
        `That has ${pr.rows.length.toLocaleString()} rows. You can import up to ${MAX_IMPORT_ROWS.toLocaleString()} at a time. Split it into smaller files and import them one after another.`,
      );
      return;
    }
    setSource(src);
    setParsed(pr);
    setMapping(pr.mapping);
  }

  async function onFile(file: File | File[] | null) {
    const f = Array.isArray(file) ? file[0] : file;
    if (!f) return;
    // Guard on size BEFORE reading the file, so an oversized upload can't OOM the tab.
    if (f.size > MAX_IMPORT_FILE_BYTES) {
      setParsed(null);
      setResult(null);
      setParseError(
        `That file is ${(f.size / (1024 * 1024)).toFixed(1)} MB. Import files must be under ${MAX_IMPORT_FILE_MB} MB. Export just the columns you need (name and email are enough), or split it into smaller files.`,
      );
      return;
    }
    try {
      const isXlsx = /\.xlsx?$/i.test(f.name) || f.name.toLowerCase().endsWith(".xls");
      if (isXlsx) {
        acceptParse(parseXlsx(new Uint8Array(await f.arrayBuffer())), "xlsx");
      } else {
        acceptParse(parseCsv(await f.text()), "csv");
      }
    } catch {
      setParseError("Couldn't read that file. Make sure it's a valid CSV or Excel file.");
    }
  }

  function onPreviewPaste() {
    if (!pasteText.trim()) {
      setParseError("Paste some rows first (include a header row like: name, email).");
      return;
    }
    acceptParse(parsePaste(pasteText), "paste");
  }

  const setField = (field: MappingField) => (value: string) =>
    setMapping((m) => ({ ...m, [field]: value === NONE ? undefined : value }));

  const canImport = Boolean(mapping.name && mapping.email) && !!parsed;

  const previewRows: RawImportRow[] = useMemo(
    () => (parsed ? parsed.records.map((r) => applyMapping(r, mapping)) : []),
    [parsed, mapping],
  );

  async function runImport() {
    if (!parsed) return;
    setIsImporting(true);
    setParseError(null);
    try {
      const summary = await apiRequest<ImportResult>("/api/contacts/import", {
        method: "POST",
        json: { source, rows: previewRows },
      });
      setResult(summary);
      if (summary.imported > 0) {
        toast({ body: `Imported ${summary.imported} contact${summary.imported === 1 ? "" : "s"}.` });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError && err.body.fields
          ? Object.values(err.body.fields)[0] ?? "The import couldn't be processed."
          : "The import couldn't be processed. Please try again.";
      setParseError(msg);
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setParsed(null);
    setResult(null);
    setPasteText("");
    setParseError(null);
    setMapping({});
  }

  const columnOptions = (includeNone: boolean) => [
    ...(includeNone ? [{ value: NONE, label: "Not imported" }] : []),
    ...(parsed?.columns ?? []).map((c) => ({ value: c, label: c })),
  ];

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <HStack gap={2} align="center">
          <Link href="/contacts">
            <Text color="secondary">Contacts</Text>
          </Link>
          <Text color="secondary">/</Text>
          <Text>Import</Text>
        </HStack>
        <Heading level={1}>Import contacts</Heading>
        <Text color="secondary">
          Upload a CSV or Excel file, or paste rows from a spreadsheet. We&apos;ll match columns
          and flag duplicates and invalid rows before anything is saved.
        </Text>
      </VStack>

      {result ? (
        <ImportSummary result={result} onDone={reset} />
      ) : (
        <>
          {/* Wrapped so the control hugs its two segments instead of stretching the track
              full-width (which leaves a large empty area to the right of the segments). */}
          <HStack>
            <SegmentedControl
              label="Import method"
              value={method}
              onChange={(v) => { setMethod(v as Method); reset(); }}
            >
              <SegmentedControlItem value="upload" label="Upload file" />
              <SegmentedControlItem value="paste" label="Paste rows" />
            </SegmentedControl>
          </HStack>

          {method === "upload" ? (
            <FileInput
              label="Contact file"
              isLabelHidden
              mode="dropzone"
              accept=".csv,.xlsx,.xls,text/csv"
              value={null}
              onChange={onFile}
              description={`CSV or Excel (.xlsx). The first row should be column headers. Up to ${MAX_IMPORT_ROWS.toLocaleString()} contacts per import.`}
            />
          ) : (
            <VStack gap={3} align="stretch">
              <TextArea
                label="Paste rows"
                isLabelHidden
                value={pasteText}
                onChange={setPasteText}
                rows={7}
                placeholder={"name, email, company, role\nAda Lovelace, ada@analytical.io, Analytical Engines, Lead Recruiter"}
              />
              <HStack>
                <Button label="Preview rows" variant="secondary" onClick={onPreviewPaste} />
              </HStack>
            </VStack>
          )}

          {parseError && <Banner status="error" title="Couldn't read those contacts" description={parseError} container="card" />}

          {parsed && (
            <Card>
              <VStack gap={4}>
                <VStack gap={1}>
                  <Heading level={2}>Match columns</Heading>
                  <Text color="secondary">
                    {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} detected. Name and
                    email are required.
                  </Text>
                </VStack>
                <Grid columns={2} gap={4}>
                  <Selector
                    label="Name"
                    isRequired
                    options={columnOptions(false)}
                    value={mapping.name ?? ""}
                    onChange={setField("name")}
                    placeholder="Select a column"
                    status={mapping.name ? undefined : { type: "error", message: "Required" }}
                  />
                  <Selector
                    label="Email"
                    isRequired
                    options={columnOptions(false)}
                    value={mapping.email ?? ""}
                    onChange={setField("email")}
                    placeholder="Select a column"
                    status={mapping.email ? undefined : { type: "error", message: "Required" }}
                  />
                  <Selector
                    label="Company"
                    isOptional
                    options={columnOptions(true)}
                    value={mapping.company ?? NONE}
                    onChange={setField("company")}
                  />
                  <Selector
                    label="Role"
                    isOptional
                    options={columnOptions(true)}
                    value={mapping.role ?? NONE}
                    onChange={setField("role")}
                  />
                </Grid>
                <Divider />
                <HStack justify="end" gap={2}>
                  <Button label="Cancel" variant="ghost" onClick={reset} isDisabled={isImporting} />
                  <Button
                    label={`Import ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"}`}
                    variant="primary"
                    onClick={runImport}
                    isLoading={isImporting}
                    isDisabled={!canImport}
                  />
                </HStack>
              </VStack>
            </Card>
          )}
        </>
      )}
    </VStack>
  );
}

function ImportSummary({ result, onDone }: { result: ImportResult; onDone: () => void }) {
  const router = useRouter();
  const { imported, duplicates, invalid, contactIds } = result;
  const skipped = duplicates.length + invalid.length;
  const batchCount = contactIds.length;
  const canCompose = batchCount > 0;

  // Carry the batch straight into Compose so the user never re-selects the list they just
  // imported. The stash must land before the client navigation reads it, so write then push.
  function composeToBatch() {
    stashPreselect(contactIds);
    router.push("/compose");
  }

  return (
    <VStack gap={4}>
      <Banner
        status={imported > 0 ? "success" : "warning"}
        container="card"
        title={
          imported > 0
            ? `Imported ${imported} contact${imported === 1 ? "" : "s"}`
            : "No new contacts imported"
        }
        description={
          skipped > 0
            ? `${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} and ${invalid.length} invalid row${invalid.length === 1 ? "" : "s"} were skipped and are listed below.`
            : "Everything looked good."
        }
      />

      {duplicates.length > 0 && (
        <Card>
          <VStack gap={2}>
            <Heading level={3}>Duplicates skipped ({duplicates.length})</Heading>
            <Text color="secondary">Already in your contacts, so they weren&apos;t added again.</Text>
            <VStack gap={1}>
              {duplicates.slice(0, 50).map((d) => (
                <Text key={`${d.row}-${d.email}`} size="sm">Row {d.row}: {d.email}</Text>
              ))}
            </VStack>
          </VStack>
        </Card>
      )}

      {invalid.length > 0 && (
        <Card>
          <VStack gap={2}>
            <Heading level={3}>Invalid rows skipped ({invalid.length})</Heading>
            <Text color="secondary">These couldn&apos;t be imported. Fix them in your source and re-import.</Text>
            <VStack gap={1}>
              {invalid.slice(0, 50).map((r) => (
                <Text key={r.row} size="sm">Row {r.row}: {r.reason}</Text>
              ))}
            </VStack>
          </VStack>
        </Card>
      )}

      <VStack gap={2}>
        <HStack gap={2}>
          {canCompose && (
            <Button
              label={`Compose to ${batchCount} contact${batchCount === 1 ? "" : "s"}`}
              variant="primary"
              onClick={composeToBatch}
            />
          )}
          <Button as={Link} href="/contacts" label="View contacts" variant={canCompose ? "secondary" : "primary"} />
          <Button label="Import more" variant={canCompose ? "ghost" : "secondary"} onClick={onDone} />
        </HStack>
        {canCompose && batchCount > imported && (
          <Text color="secondary" size="sm">
            Includes {batchCount - imported} already in your contacts. You&apos;ll see a heads-up before emailing anyone twice.
          </Text>
        )}
      </VStack>
    </VStack>
  );
}
