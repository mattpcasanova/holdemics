import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { AccountSync } from "@/components/auth/AccountSync";
import { PresenceTracker } from "@/components/friends/PresenceTracker";
import { createClient, getViewer } from "@/lib/supabase/server";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Holdemics",
  description: "Placement poker with ratings. Eight players, 100 HP each, top four climb.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();
  let username: string | null = null;
  if (viewer) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("username").eq("id", viewer.id).maybeSingle();
    username = data?.username ?? null;
  }
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-page text-text-primary">
        <AccountSync userId={viewer?.id ?? null} />
        {viewer && username && <PresenceTracker userId={viewer.id} username={username} />}
        {children}
      </body>
    </html>
  );
}
