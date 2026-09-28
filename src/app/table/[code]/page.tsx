import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnlineTable } from "@/components/table/OnlineTable";
import { getViewer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Table · Holdemics" };

export default async function TablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{5,8}$/.test(code)) redirect("/");
  if (!(await getViewer())) redirect(`/login?next=/table/${code}`);

  const serverWs = process.env.NEXT_PUBLIC_TABLE_SERVER_WS;
  if (!serverWs) {
    return <div className="flex min-h-dvh items-center justify-center text-text-secondary">The table server isn&apos;t configured.</div>;
  }
  return <OnlineTable code={code} serverWs={serverWs} />;
}
