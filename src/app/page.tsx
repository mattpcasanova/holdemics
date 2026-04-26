import { Header } from "@/components/Header";
import { LobbyHero } from "@/components/LobbyHero";
import { GameModeCard } from "@/components/GameModeCard";
import { RecentGameRow } from "@/components/RecentGameRow";
import { RatingCard } from "@/components/RatingCard";
import { FriendsList } from "@/components/FriendsList";
import { DailyChallenge } from "@/components/DailyChallenge";
import type { GameMode, RecentGame, Friend } from "@/lib/types";

const GAME_MODES: GameMode[] = [
  {
    name: "Standard",
    bbs: 100,
    description: "Standard 6-max. 30s decisions, no time bank.",
    duration: "~25 min",
    playerCount: "412 playing",
    badge: { text: "100bb", color: "felt" },
  },
  {
    name: "Turbo",
    bbs: 50,
    description: "Fast blinds, 15s decisions. Soon.",
    duration: "~10 min",
    playerCount: "coming soon",
    badge: { text: "50bb", color: "gold" },
  },
  {
    name: "Slow roll",
    bbs: 100,
    description: "Deep stacks, 60s decisions. Soon.",
    duration: "~45 min",
    playerCount: "coming soon",
    badge: { text: "100bb", color: "felt" },
  },
  {
    name: "vs Bots",
    bbs: 100,
    description: "Practice vs AI. 4 difficulties.",
    duration: "no rating change",
    playerCount: "",
    badge: { text: "unrated", color: "gray" },
  },
];

const RECENT_GAMES: RecentGame[] = [
  { placement: 1, mode: "Standard", bbs: 100, duration: "23 min", playerCount: 6, ratingChange: 30, timeAgo: "2h ago" },
  { placement: 3, mode: "Standard", bbs: 100, duration: "28 min", playerCount: 6, ratingChange: 5, timeAgo: "5h ago" },
  { placement: 5, mode: "Standard", bbs: 100, duration: "19 min", playerCount: 6, ratingChange: -15, timeAgo: "yesterday" },
  { placement: 2, mode: "Standard", bbs: 100, duration: "31 min", playerCount: 6, ratingChange: 15, timeAgo: "yesterday" },
];

const FRIENDS: Friend[] = [
  { name: "sam", initials: "SK", status: "at-table", statusText: "at table", rating: 1302 },
  { name: "bigD", initials: "BD", status: "online", statusText: "in lobby", rating: 1156 },
  { name: "vivi", initials: "VV", status: "offline", statusText: "offline", rating: 1089 },
];

export default function LobbyPage() {
  return (
    <div className="max-w-[920px] mx-auto w-full">
      <div className="bg-surface-primary rounded-xl border-[0.5px] border-border overflow-hidden">
        <Header variant="lobby" onlineCount={1247} userInitials="MC" />

        <div className="grid grid-cols-[1fr_240px] gap-4 p-5">
          {/* Main column */}
          <div>
            <LobbyHero />

            <div className="text-[11px] text-text-secondary tracking-widest font-medium mt-1.5 mb-2.5">
              GAME MODES
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {GAME_MODES.map((mode) => (
                <GameModeCard key={mode.name} mode={mode} />
              ))}
            </div>

            <div className="text-[11px] text-text-secondary tracking-widest font-medium mt-1.5 mb-2.5">
              RECENT GAMES
            </div>
            <div className="bg-surface-card border-[0.5px] border-border rounded-lg overflow-hidden">
              {RECENT_GAMES.map((game, i) => (
                <RecentGameRow
                  key={i}
                  game={game}
                  isLast={i === RECENT_GAMES.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <RatingCard
              username="mattcasanova"
              initials="MC"
              rank="Iron III"
              percentile="top 18%"
              rating={1247}
              ratingChange={35}
              changePeriod="7d"
              gamesPlayed={84}
              itmRate="52%"
              bestRating={1289}
            />
            <FriendsList friends={FRIENDS} />
            <DailyChallenge
              title="Place top 3 twice"
              reward="+10 bonus rating"
              progress={1}
              total={2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
