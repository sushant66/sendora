"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useToast } from "@astryxdesign/core/Toast";
import { ApiError, apiRequest } from "@/lib/api/client";
import { MailIcon } from "@/components/app-icons";
import type { ConnectedAccount, EmailAccountsStatus } from "@/lib/email/types";
import type { ProviderKey } from "@/lib/email/provider";

type Meta = {
  key: ProviderKey;
  label: string;
  method: "oauth" | "credentials";
  hint: string;
};

// Fixed display order. Copy is provider-specific; both connect to your own mailbox so replies
// land back in your real inbox.
const PROVIDERS: Meta[] = [
  {
    key: "gmail",
    label: "Gmail",
    method: "oauth",
    hint: "Send from your Gmail address. Sendora only asks to send, never to read your mail.",
  },
  {
    key: "yahoo",
    label: "Yahoo Mail",
    method: "credentials",
    hint: "Send from your Yahoo address using an app password you generate in Yahoo.",
  },
];

function labelFor(key: ProviderKey): string {
  return PROVIDERS.find((p) => p.key === key)?.label ?? key;
}

export function EmailAccountView() {
  const toast = useToast();
  const params = useSearchParams();
  const [data, setData] = useState<EmailAccountsStatus | null>(null);
  const [busy, setBusy] = useState<ProviderKey | null>(null);
  const [yahooOpen, setYahooOpen] = useState(false);
  const [yahooPrefill, setYahooPrefill] = useState("");
  const [disconnecting, setDisconnecting] = useState<ProviderKey | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  async function refresh() {
    try {
      setData(await apiRequest<EmailAccountsStatus>("/api/email-account/accounts"));
    } catch {
      toast({ body: "Couldn't load your email accounts.", type: "error" });
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setData(await apiRequest<EmailAccountsStatus>("/api/email-account/accounts"));
      } catch {
        toast({ body: "Couldn't load your email accounts.", type: "error" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface the OAuth round-trip outcome once, on return from the provider.
  useEffect(() => {
    if (params.get("connected")) toast({ body: "Email account connected. You can send now." });
    if (params.get("error"))
      toast({ body: "Couldn't connect that account. Please try again.", type: "error" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountFor = (key: ProviderKey): ConnectedAccount | undefined =>
    data?.accounts.find((a) => a.provider === key);

  async function connectOAuth(provider: ProviderKey) {
    setBusy(provider);
    try {
      const { authorizeUrl } = await apiRequest<{ authorizeUrl: string }>(
        "/api/email-account/connect",
        {
          method: "POST",
          json: { provider },
        },
      );
      window.location.assign(authorizeUrl);
    } catch {
      toast({ body: `Couldn't start connecting ${labelFor(provider)}.`, type: "error" });
      setBusy(null);
    }
  }

  function startConnect(meta: Meta, existingEmail?: string) {
    if (meta.method === "oauth") return connectOAuth(meta.key);
    setYahooPrefill(existingEmail ?? "");
    setYahooOpen(true);
  }

  async function makeActive(provider: ProviderKey) {
    setBusy(provider);
    try {
      await apiRequest("/api/email-account/activate", { method: "POST", json: { provider } });
      await refresh();
      toast({ body: `${labelFor(provider)} is now your sending account.` });
    } catch {
      toast({ body: "Couldn't switch your sending account.", type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: ProviderKey) {
    setIsDisconnecting(true);
    try {
      await apiRequest(`/api/email-account?provider=${provider}`, { method: "DELETE" });
      setDisconnecting(null);
      await refresh();
      toast({ body: `${labelFor(provider)} disconnected.` });
    } catch {
      toast({ body: "Couldn't disconnect. Please try again.", type: "error" });
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <VStack gap={5} style={{ maxWidth: 640 }}>
      <VStack gap={1}>
        <Heading level={1}>Email accounts</Heading>
        <Text color="secondary">
          Connect the inbox you want outreach to send from. You can connect more than one and pick
          which is active. Only the active account sends.
        </Text>
      </VStack>

      {data === null ? (
        <VStack gap={3} align="stretch">
          <ProviderSkeleton />
          <ProviderSkeleton />
        </VStack>
      ) : (
        <VStack gap={3} align="stretch">
          {PROVIDERS.filter(
            (p) => data.availableProviders.includes(p.key) || accountFor(p.key),
          ).map((meta) => (
            <ProviderRow
              key={meta.key}
              meta={meta}
              account={accountFor(meta.key)}
              busy={busy === meta.key}
              onConnect={() => startConnect(meta, accountFor(meta.key)?.emailAddress)}
              onMakeActive={() => makeActive(meta.key)}
              onDisconnect={() => setDisconnecting(meta.key)}
            />
          ))}
        </VStack>
      )}

      <YahooConnectDialog
        isOpen={yahooOpen}
        onOpenChange={setYahooOpen}
        prefillEmail={yahooPrefill}
        onConnected={async () => {
          setYahooOpen(false);
          await refresh();
          toast({ body: "Yahoo Mail connected. You can send now." });
        }}
      />

      <AlertDialog
        isOpen={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={`Disconnect ${disconnecting ? labelFor(disconnecting) : ""}?`}
        description="You won't be able to send from this account until you reconnect. Your contacts, templates, and history are kept."
        actionLabel="Disconnect"
        onAction={() => disconnecting && disconnect(disconnecting)}
        isActionLoading={isDisconnecting}
      />
    </VStack>
  );
}

function ProviderRow({
  meta,
  account,
  busy,
  onConnect,
  onMakeActive,
  onDisconnect,
}: {
  meta: Meta;
  account?: ConnectedAccount;
  busy: boolean;
  onConnect: () => void;
  onMakeActive: () => void;
  onDisconnect: () => void;
}) {
  const connected = account !== undefined;
  const expired = account?.status === "expired";
  const active = account?.status === "active" && account.isActive;
  const healthyInactive = account?.status === "active" && !account.isActive;

  const dot = expired ? "warning" : active ? "success" : connected ? "neutral" : "neutral";
  const subtitle = expired
    ? meta.method === "oauth"
      ? "Authorization expired. Reconnect to keep sending."
      : "Sign-in expired. Reconnect with a fresh app password."
    : (account?.emailAddress ?? meta.hint);

  return (
    <Card padding={5}>
      <HStack justify="between" align="center" gap={4}>
        <HStack gap={3} align="center" style={{ minWidth: 0 }}>
          <StatusDot variant={dot} label={connected ? account!.status : "Not connected"} />
          <VStack gap={1} style={{ minWidth: 0 }}>
            <HStack gap={2} align="center">
              <Text weight="medium">{meta.label}</Text>
              {active && <Badge variant="success" label="Active" />}
            </HStack>
            <Text color="secondary" maxLines={1}>
              {subtitle}
            </Text>
          </VStack>
        </HStack>

        <HStack gap={2} align="center">
          {!connected && (
            <Button
              label={`Connect ${meta.label}`}
              variant="secondary"
              icon={
                meta.method === "oauth" ? (
                  <Icon icon="externalLink" size="xsm" />
                ) : (
                  <MailIcon width={15} height={15} />
                )
              }
              onClick={onConnect}
              isLoading={busy}
            >
              Connect
            </Button>
          )}
          {expired && (
            <Button
              label={`Reconnect ${meta.label}`}
              variant="primary"
              onClick={onConnect}
              isLoading={busy}
            >
              Reconnect
            </Button>
          )}
          {healthyInactive && (
            <Button
              label={`Make ${meta.label} active`}
              variant="secondary"
              icon={<Icon icon="check" size="xsm" />}
              onClick={onMakeActive}
              isLoading={busy}
            >
              Make active
            </Button>
          )}
          {connected && (
            <MoreMenu
              label={`More actions for ${meta.label}`}
              items={[{ label: "Disconnect", onClick: onDisconnect }]}
            />
          )}
        </HStack>
      </HStack>
    </Card>
  );
}

function ProviderSkeleton() {
  return (
    <Card padding={5}>
      <HStack justify="between" align="center" gap={4}>
        <HStack gap={3} align="center">
          <Skeleton width={10} height={10} radius="rounded" />
          <VStack gap={2}>
            <Skeleton width={90} height={14} radius={2} />
            <Skeleton width={200} height={12} radius={2} />
          </VStack>
        </HStack>
        <Skeleton width={110} height={38} radius={2} />
      </HStack>
    </Card>
  );
}

function YahooConnectDialog({
  isOpen,
  onOpenChange,
  prefillEmail,
  onConnected,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  prefillEmail: string;
  onConnected: () => void | Promise<void>;
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={460}>
      <DialogHeader title="Connect Yahoo Mail" />
      <YahooConnectForm
        key={isOpen ? `open:${prefillEmail}` : "closed"}
        prefillEmail={prefillEmail}
        onCancel={() => onOpenChange(false)}
        onConnected={onConnected}
      />
    </Dialog>
  );
}

function YahooConnectForm({
  prefillEmail,
  onCancel,
  onConnected,
}: {
  prefillEmail: string;
  onCancel: () => void;
  onConnected: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [email, setEmail] = useState(prefillEmail);
  const [appPassword, setAppPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; appPassword?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = "Enter a valid Yahoo email.";
    if (appPassword.trim().length === 0) next.appPassword = "Paste the app password from Yahoo.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSaving(true);
    try {
      await apiRequest("/api/email-account/credentials", {
        method: "POST",
        json: { provider: "yahoo", email: email.trim(), appPassword: appPassword.trim() },
      });
      await onConnected();
    } catch (err) {
      if (err instanceof ApiError && err.body.error === "invalid_credentials") {
        setErrors({ appPassword: "That email and app password didn't sign in to Yahoo." });
      } else {
        toast({ body: "Couldn't connect Yahoo. Please try again.", type: "error" });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <VStack gap={4} align="stretch">
        <TextInput
          label="Yahoo email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@yahoo.com"
          hasAutoFocus
          status={errors.email ? { type: "error", message: errors.email } : undefined}
        />
        <VStack gap={2} align="stretch">
          <TextInput
            label="App password"
            type="password"
            value={appPassword}
            onChange={setAppPassword}
            description="Not your Yahoo login password. Generate an app password in Yahoo."
            status={errors.appPassword ? { type: "error", message: errors.appPassword } : undefined}
          />
          <Text size="sm" color="secondary">
            In Yahoo, go to Account Security, then App passwords.{" "}
            <a
              href="https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-text-accent)", textDecoration: "underline" }}
            >
              How to generate one
            </a>
          </Text>
        </VStack>
        <HStack justify="end" gap={2}>
          <Button label="Cancel" variant="ghost" onClick={onCancel} isDisabled={isSaving} />
          <Button label="Connect Yahoo" variant="primary" type="submit" isLoading={isSaving} />
        </HStack>
      </VStack>
    </form>
  );
}
