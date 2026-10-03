import { LobbyHero } from "@/components/lobby/LobbyHero";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { PracticePicker } from "@/components/lobby/PracticePicker";
import { RecentGames } from "@/components/lobby/RecentGames";
import { PlayWithFriends } from "@/components/lobby/PlayWithFriends";
import { ProfileCard, RulesCard } from "@/components/lobby/SidePanels";
import { getAccount } from "@/lib/account";
import { type ModeId, MODES } from "@/lib/engine/modes";

export default async function LobbyPage({ searchParams }: { searchParams: Promise<{ queue?: string }> }) {
  const [account, params] = await Promise.all([getAccount(), searchParams]);
  // "Find another match" from a ranked result lands here and re-enters the queue.
  const queueMode = params.queue && params.queue in MODES ? (params.queue as ModeId) : null;
  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="Play" profile={account?.profile ?? null} />
      <MobileTopBar profile={account?.profile ?? null} />
      {/* Below xl the two columns dissolve into one list, ordered so playing (ranked, friends, practice) comes first. */}
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[1fr_300px] gap-6 p-4 sm:p-6 max-xl:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-8 max-xl:contents">
          <div className="max-xl:order-1">
            <LobbyHero signedIn={!!account} serverWs={process.env.NEXT_PUBLIC_TABLE_SERVER_WS ?? null} queueMode={queueMode} />
          </div>
          <div className="max-xl:order-3">
            <PracticePicker />
          </div>
          <div className="max-xl:order-5">
            <RecentGames games={account?.recent ?? []} signedIn={!!account} now={account?.loadedAt ?? 0} />
          </div>
        </div>
        <aside className="flex flex-col gap-4 max-xl:contents">
          <div className="max-xl:order-4">
            <ProfileCard account={account} />
          </div>
          <div className="max-xl:order-2">
            <PlayWithFriends signedIn={!!account} />
          </div>
          <div className="max-xl:order-6">
            <RulesCard />
          </div>
        </aside>
      </div>
    </div>
  );
}
