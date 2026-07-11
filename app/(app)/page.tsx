import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <VStack gap={4}>
      <Heading level={1}>Welcome{user?.name ? `, ${user.name}` : ""}</Heading>
      <Text>
        Import recruiter contacts, pick or write a template, and send personalized
        outreach. Choose a section from the sidebar to get started.
      </Text>
    </VStack>
  );
}
