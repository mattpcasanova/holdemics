import { LobbyHero } from "@/components/lobby/LobbyHero";
import { NavRail } from "@/components/lobby/NavRail";
import { PracticePicker } from "@/components/lobby/PracticePicker";
import { FriendsCard, ProfileCard, RulesCard } from "@/components/lobby/SidePanels";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";

export default function LobbyPage() {
  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="Play" />
      <MobileTopBar />
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[1fr_300px] gap-6 p-4 sm:p-6 max-xl:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-8">
          <LobbyHero />
          <PracticePicker />
        </div>
        <aside className="flex flex-col gap-4">
          <ProfileCard />
          <FriendsCard />
          <RulesCard />
        </aside>
      </div>
    </div>
  );
}
