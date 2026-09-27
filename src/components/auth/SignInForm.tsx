"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthFormState, signIn } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton } from "./AuthShell";

export function SignInForm({ next, notice }: { next: string; notice?: { tone: "error" | "info"; text: string } }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error ? <FormMessage tone="error">{state.error}</FormMessage> : notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" defaultValue={state?.values?.email} autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton pending={pending}>{pending ? "Signing in" : "Sign in"}</SubmitButton>
      <p className="text-center text-[13px] text-text-secondary">
        New here?{" "}
        <Link href="/signup" className="font-medium text-gold hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
