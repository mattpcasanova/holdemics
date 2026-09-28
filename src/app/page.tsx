import { LobbyHero } from "@/components/lobby/LobbyHero";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { PracticePicker } from "@/components/lobby/PracticePicker";
import { RecentGames } from "@/components/lobby/RecentGames";
import { PlayWithFriends } from "@/components/lobby/PlayWithFriends";
import { ProfileCard, RulesCard } from "@/components/lobby/SidePanels";
import { getAccount } from "@/lib/account";

export default async function LobbyPage() {
  const account = await getAccount();
  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="Play" profile={account?.profile ?? null} />
      <MobileTopBar profile={account?.profile ?? null} />
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[1fr_300px] gap-6 p-4 sm:p-6 max-xl:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-8">
          <LobbyHero />
          <PracticePicker />
          <RecentGames games={account?.recentPractice ?? []} signedIn={!!account} now={account?.loadedAt ?? 0} />
        </div>
        <aside className="flex flex-col gap-4">
          <ProfileCard account={account} />
          <PlayWithFriends signedIn={!!account} />
          <RulesCard />
        </aside>
      </div>
    </div>
  );
}
