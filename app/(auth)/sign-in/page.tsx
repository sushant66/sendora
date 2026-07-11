import { VStack } from "@astryxdesign/core/VStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { signIn } from "@/lib/auth/config";

export default function SignInPage() {
  return (
    <VStack gap={4} style={{ maxWidth: 400, marginInline: "auto", marginBlock: "10vh" }}>
      <Heading level={1}>Sign in to Sendora</Heading>
      <Text>Use your Google account to sign in and send outreach from your own inbox.</Text>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="primary" label="Continue with Google" />
      </form>
    </VStack>
  );
}
