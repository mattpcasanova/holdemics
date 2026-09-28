import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FriendsPanel } from "@/components/friends/FriendsPanel";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { getAccount } from "@/lib/account";
import { getFriends } from "@/lib/friends";

export const metadata: Metadata = { title: "Friends · Holdemics" };

export default async function FriendsPage() {
  const account = await getAccount();
  if (!account) redirect("/login?next=/friends");
  const data = await getFriends(account.profile.id);

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="Friends" profile={account.profile} />
      <MobileTopBar profile={account.profile} />
      <div className="mx-auto w-full max-w-[1240px] p-4 sm:p-6">
        <h1 className="mb-1 font-display text-[28px] font-semibold tracking-tight">Friends</h1>
        <p className="mb-6 text-[14px] text-text-secondary">
          See who&apos;s online and invite them to a private table. Private games never change anyone&apos;s rating.
        </p>
        <FriendsPanel data={data} />
      </div>
    </div>
  );
}
