"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState =
  | { error?: string; checkEmail?: string; values?: { username?: string; email?: string } }
  | undefined;

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Only allow redirects back into this site. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signUp(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const username = String(form.get("username") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const values = { username, email };
  if (!USERNAME.test(username)) return { error: "Usernames are 3–20 letters, numbers, or underscores.", values };
  if (!email.includes("@")) return { error: "Enter a valid email address.", values };
  if (password.length < 8) return { error: "Passwords need at least 8 characters.", values };

  const supabase = await createClient();
  const { data: available } = await supabase.rpc("username_available", { name: username });
  if (available === false) return { error: `${username} is taken. Try another username.`, values };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username }, emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error) return { error: error.message, values };

  // With email confirmation on, there's no session until the link is clicked.
  if (!data.session) return { checkEmail: email };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signIn(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirm your email first. Check your inbox for the link."
          : "That email and password don't match an account.",
      values: { email },
    };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
