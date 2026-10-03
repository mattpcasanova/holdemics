import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { FriendButton, ProfilePresence } from "@/components/profile/ProfileActions";
import { AchievementBadge } from "@/components/ui/AchievementBadge";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerTitle } from "@/components/ui/PlayerTitle";
import { RankedStatTiles } from "@/components/ui/RankedStatTiles";
import { Sparkline } from "@/components/ui/Sparkline";
import { getAccount } from "@/lib/account";
import { ACHIEVEMENT_BY_ID, ACHIEVEMENTS } from "@/lib/achievements";
import { RARITY } from "@/lib/cosmetics";
import { MODES } from "@/lib/engine/modes";
import { type ModeSummary, getProfile } from "@/lib/profile";
import { ordinal, placementGames } from "@/lib/rating";
import { tierFor } from "@/lib/tiers";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `${decodeURIComponent(username)} · Holdemics` };
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const account = await getAccount();
  const data = await getProfile(decodeURIComponent(username), account?.profile.id ?? null);
  if (!data) notFound();
  const { profile, modes, recent, achievements, friends, relationship } = data;
  const earned = achievements.map((a) => ACHIEVEMENT_BY_ID.get(a.id)).filter((a) => a !== undefined);
  const totalGames = modes.reduce((n, m) => n + m.games, 0);

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="" profile={account?.profile ?? null} />
      <MobileTopBar profile={account?.profile ?? null} />
      <div className="mx-auto w-full max-w-[1240px] p-4 sm:p-6">
        <header className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-primary p-4 sm:gap-5 sm:p-5">
          <Avatar name={profile.username} avatar={profile.avatar} size={84} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[28px] font-semibold leading-tight tracking-tight">{profile.username}</h1>
            <PlayerTitle id={profile.title} size={12} className="mt-1" />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-text-tertiary">
              {account && <ProfilePresence userId={profile.id} />}
              <span>Joined {monthFmt.format(new Date(profile.joinedAt))}</span>
              <span>
                {totalGames} ranked {totalGames === 1 ? "game" : "games"}
              </span>
              <span>
                {friends.length} {friends.length === 1 ? "friend" : "friends"}
              </span>
            </div>
          </div>
          {relationship === "self" ? (
            <p className="text-[12.5px] text-text-tertiary">Change your avatar and title in Settings.</p>
          ) : (
            <FriendButton userId={profile.id} username={profile.username} relationship={relationship} />
          )}
        </header>

        <div className="grid grid-cols-[1fr_340px] gap-6 max-lg:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-6">
            <section aria-labelledby="ratings-heading">
              <h2 id="ratings-heading" className="mb-3 font-display text-[18px] font-semibold">
                Ratings
              </h2>
              <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                {modes.map((m) => (
                  <RatingCard key={m.mode} summary={m} />
                ))}
              </div>
            </section>

            <section aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="mb-3 font-display text-[18px] font-semibold">
                Recent ranked games
              </h2>
              {recent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-5 text-[13px] text-text-secondary">No ranked games yet.</div>
              ) : (
                <ol className="overflow-hidden rounded-xl border border-border bg-surface-primary">
                  {recent.map((g, i) => {
                    const top = g.place <= Math.floor(g.players / 2);
                    const delta = g.ratingAfter - g.ratingBefore;
                    return (
                      <li key={g.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}>
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-semibold ${
                            g.place === 1 ? "bg-gold text-surface-primary" : top ? "bg-gold/15 text-gold" : "bg-red/15 text-red-muted"
                          }`}
                        >
                          {ordinal(g.place)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium">Ranked {MODES[g.mode].name}</div>
                          <div className="text-[12px] text-text-tertiary">
                            {g.players} players · {dateFmt.format(new Date(g.playedAt))}
                          </div>
                        </div>
                        <div className="text-right tabular-nums">
                          <div className={`font-display text-[14px] font-semibold ${delta >= 0 ? "text-felt-light" : "text-red-muted"}`}>
                            {delta >= 0 ? "+" : ""}
                            {delta}
                          </div>
                          <div className="text-[11.5px] text-text-tertiary">{g.ratingAfter}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <section aria-labelledby="ach-heading" className="rounded-xl border border-border bg-surface-primary p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 id="ach-heading" className="font-display text-[15px] font-semibold">
                  Achievements <span className="text-text-tertiary">{earned.length}/{ACHIEVEMENTS.length}</span>
                </h2>
                {relationship === "self" && (
                  <Link href="/achievements" className="text-[12px] text-gold hover:underline">
                    See all
                  </Link>
                )}
              </div>
              {earned.length === 0 ? (
                <p className="text-[13px] text-text-secondary">None yet. Achievements come from ranked games and private tables without bots.</p>
              ) : (
                <ul className="grid grid-cols-5 gap-2 max-lg:grid-cols-8 max-sm:grid-cols-5">
                  {earned.map((a) => (
                    <li key={a.id} title={`${a.name} · ${RARITY[a.rarity].label}\n${a.description}`} className="flex justify-center">
                      <AchievementBadge achievement={a} earned size={44} />
                      <span className="sr-only">{a.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="friends-heading" className="rounded-xl border border-border bg-surface-primary p-4">
              <h2 id="friends-heading" className="mb-2 font-display text-[15px] font-semibold">
                Friends <span className="text-text-tertiary">{friends.length}</span>
              </h2>
              {friends.length === 0 ? (
                <p className="text-[13px] text-text-secondary">No friends yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {friends.map((f) => (
                    <li key={f.id} className="border-t border-border first:border-t-0">
                      <Link href={`/u/${f.username}`} className="flex items-center gap-3 py-2 transition hover:text-gold">
                        <Avatar name={f.username} avatar={f.avatar} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium">{f.username}</div>
                          <PlayerTitle id={f.title} size={9} className="mt-0.5" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingCard({ summary: m }: { summary: ModeSummary }) {
  const tier = tierFor(m.mode, m.rating, m.games, m.rank);
  const placing = m.games < placementGames(m.mode);
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-primary p-4">
      <div className="flex items-center justify-between text-[12.5px] text-text-secondary">
        <span>{MODES[m.mode].name}</span>
        {m.rank !== null && !placing && <span className="tabular-nums text-text-tertiary">#{m.rank}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-display text-[28px] font-semibold leading-none tabular-nums">{m.rating}</span>
        <Sparkline values={m.trend} width={84} height={26} label={`${MODES[m.mode].name} rating trend`} />
      </div>
      <div className="text-[13px] font-medium" style={{ color: tier.color }}>
        {tier.name}
      </div>
      <div className="text-[11.5px] tabular-nums text-text-tertiary">
        {placing ? `Placement ${m.games}/${placementGames(m.mode)}` : `Peak ${m.peak} · ${m.games} games`}
      </div>
      {m.record.games > 0 && (
        <div className="mt-2">
          <RankedStatTiles summary={m.record} mode={m.mode} compact brief />
        </div>
      )}
    </div>
  );
}
