"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Banner } from "@astryxdesign/core/Banner";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import { apiRequest } from "@/lib/api/client";
import type { AccountStatus } from "@/lib/email/types";

export function EmailAccountView() {
  const toast = useToast();
  const params = useSearchParams();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  async function refresh() {
    try {
      setStatus(await apiRequest<AccountStatus>("/api/email-account"));
    } catch {
      toast({ body: "Couldn't load your email account status.", type: "error" });
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setStatus(await apiRequest<AccountStatus>("/api/email-account"));
      } catch {
        toast({ body: "Couldn't load your email account status.", type: "error" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface the OAuth round-trip outcome once, on return from Google.
  useEffect(() => {
    if (params.get("connected")) toast({ body: "Gmail connected — you can send from your inbox now." });
    if (params.get("error")) toast({ body: "Couldn't connect Gmail. Please try again.", type: "error" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setIsConnecting(true);
    try {
      const { authorizeUrl } = await apiRequest<{ authorizeUrl: string }>("/api/email-account/connect", { method: "POST" });
      window.location.href = authorizeUrl;
    } catch {
      toast({ body: "Couldn't start the Google connection.", type: "error" });
      setIsConnecting(false);
    }
  }

  async function disconnect() {
    setIsDisconnecting(true);
    try {
      await apiRequest("/api/email-account", { method: "DELETE" });
      setDisconnectOpen(false);
      toast({ body: "Gmail disconnected." });
      await refresh();
    } catch {
      toast({ body: "Couldn't disconnect. Please try again.", type: "error" });
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <VStack gap={5} style={{ maxWidth: 640 }}>
      <VStack gap={1}>
        <Heading level={1}>Email account</Heading>
        <Text color="secondary">
          Connect your Gmail so outreach sends from your real address and replies come back to
          your inbox. Sendora only requests permission to send — never to read your mail.
        </Text>
      </VStack>

      {status === null ? (
        <Skeleton height={132} />
      ) : status.connected ? (
        <Card padding={5}>
          <VStack gap={4}>
            <HStack justify="between" align="center" gap={4}>
              <VStack gap={1}>
                <HStack gap={2} align="center">
                  <StatusDot variant="success" label="Connected" />
                  <Text weight="medium">Connected</Text>
                </HStack>
                <Text color="secondary">{status.emailAddress}</Text>
              </VStack>
              <Button label="Disconnect" variant="secondary" onClick={() => setDisconnectOpen(true)} />
            </HStack>
          </VStack>
        </Card>
      ) : status.status === "expired" ? (
        <Banner
          status="warning"
          container="card"
          title="Reconnect your Gmail"
          description="Your Gmail authorization expired. Reconnect to keep sending."
          endContent={<Button label="Reconnect Gmail" variant="primary" onClick={connect} isLoading={isConnecting} />}
        />
      ) : (
        <Card padding={5}>
          <VStack gap={4} align="start">
            <VStack gap={1}>
              <HStack gap={2} align="center">
                <StatusDot variant="neutral" label="Not connected" />
                <Text weight="medium">Not connected</Text>
              </HStack>
              <Text color="secondary">Connect Gmail to start sending outreach.</Text>
            </VStack>
            <Button label="Connect Gmail" variant="primary" onClick={connect} isLoading={isConnecting} />
          </VStack>
        </Card>
      )}

      <AlertDialog
        isOpen={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect Gmail?"
        description="You won't be able to send outreach until you reconnect. Your contacts, templates, and history are kept."
        actionLabel="Disconnect"
        onAction={disconnect}
        isActionLoading={isDisconnecting}
      />
    </VStack>
  );
}
