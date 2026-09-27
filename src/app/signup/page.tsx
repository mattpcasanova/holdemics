import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create account · Holdemics" };

export default async function SignUpPage() {
  if (await getViewer()) redirect("/");
  return (
    <AuthShell title="Create your account" subtitle="Pick a username. Everyone starts at 1500 in every mode.">
      <SignUpForm />
    </AuthShell>
  );
}
