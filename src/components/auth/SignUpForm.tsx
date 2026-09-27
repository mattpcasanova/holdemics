"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthFormState, signUp } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton } from "./AuthShell";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, undefined);

  if (state?.checkEmail) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="info">
          We sent a confirmation link to <strong>{state.checkEmail}</strong>. Open it on this device to finish signing up.
        </FormMessage>
        <Link href="/login" className="text-center text-[13px] font-medium text-gold hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state?.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        required
        minLength={3}
        maxLength={20}
        pattern="[A-Za-z0-9_]{3,20}"
        hint="3–20 letters, numbers, or underscores. Shown at the table."
      />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." />
      <SubmitButton pending={pending}>{pending ? "Creating account" : "Create account"}</SubmitButton>
      <p className="text-center text-[13px] text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
