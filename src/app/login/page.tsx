import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in · Holdemics" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await getViewer()) redirect("/");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const notice =
    params.confirmed === "1"
      ? { tone: "info" as const, text: "Email confirmed. Sign in to continue." }
      : params.error === "link"
        ? { tone: "error" as const, text: "That link expired or was already used. Sign in, or sign up again for a new link." }
        : undefined;

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track your ratings and history.">
      <SignInForm next={next} notice={notice} />
    </AuthShell>
  );
}
