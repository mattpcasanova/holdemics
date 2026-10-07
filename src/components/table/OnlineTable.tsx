"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PlayerTitle } from "@/components/ui/PlayerTitle";
import { BOT_LEVEL_COLORS, BotIcon } from "@/components/ui/BotIcon";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { useTableSocket } from "@/hooks/useTableSocket";
import { type BotLevel, BOT_LEVELS } from "@/lib/engine/bots";
import { potTotal } from "@/lib/engine/game";
import { MAX_SEATS, MODES, blindsForLevel, describeLevelLength, formatHp } from "@/lib/engine/modes";
import { abandonHands } from "@/lib/rating";
import { type StatsTable, accumulateHand } from "@/lib/stats";
import { InviteFriends } from "@/components/friends/InviteFriends";
import { announceAchievements, refreshActiveGame, sendInvite } from "@/lib/presence";
import type { SeatView, TableView } from "@/lib/realtime/protocol";
import { ACTION_BAR_SLOT, ActionBar } from "./ActionBar";
import { HandLog } from "./HandLog";
import { PokerTable } from "./PokerTable";
import { ResultOverlay } from "./ResultOverlay";
import { StandingsPanel } from "./StandingsPanel";

interface OnlineTableProps {
  code: string;
  serverWs: string;
}

export function OnlineTable({ code, serverWs }: OnlineTableProps) {
  const { view, status, error, clearError, retry, act, sit, stand, start, addBot, kick, unblock, setSeats, setMod, back } = useTableSocket(code, serverWs);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [dismissedResult, setDismissedResult] = useState(false);

  // Per-player stats from the hands we've seen (cheap enough to recompute per view).
  const stats = statsFrom(view);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  // Toast achievements as they arrive (mid-game ones right after the hand that earned them).
  const myAchievements = view?.viewerId ? view.achievements?.[view.viewerId] : undefined;
  useEffect(() => {
    if (myAchievements?.length) announceAchievements(code, myAchievements);
  }, [code, myAchievements]);

  // The server records when we start and stop being in a game here; re-read it shortly after
  // either happens so the rest of the app (rejoin banner, lobby buttons) agrees.
  const stillPlaying = !!view && view.phase === "playing" && view.you !== null && !view.game?.players[view.you]?.eliminated;
  useEffect(() => {
    const t = setTimeout(() => void refreshActiveGame(), 1500);
    return () => clearTimeout(t);
  }, [stillPlaying]);

  if (status === "unauthorized") return <Notice title="Sign in to join this table" link={{ href: `/login?next=/table/${code}`, label: "Sign in" }} />;
  if (status === "missing") return <Notice title="This table doesn't exist" body="Check the code with whoever sent it." link={{ href: "/", label: "Back to lobby" }} />;
  if (status === "refused") return <Notice title="Couldn't join this table" body={error ?? undefined} link={{ href: "/", label: "Back to lobby" }} />;
  if (status === "unreachable") {
    return (
      <Notice
        title="Can't reach the table"
        body="The connection keeps dropping before the table loads. Check your connection and try again."
        action={{ label: "Try again", onClick: retry }}
        link={{ href: "/", label: "Back to lobby" }}
      />
    );
  }
  if (!view) return <Notice title={status === "closed" ? "Reconnecting to the table" : "Joining the table"} />;

  const config = MODES[view.config.mode];
  const you = view.you;
  const hero = you ?? 0;
  const game = view.game;
  const isHost = view.viewerId === view.config.hostId;
  const canManage = isHost || view.seats.some((s) => s.userId === view.viewerId && s.isMod);
  const heroSeat = you !== null ? view.seats[you] : null;
  const ranked = !!view.config.ranked;
  const myUserId = view.viewerId;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/table/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the code is visible in the header anyway.
    }
  };

  const sidebar = game ? (
    <>
      <StandingsPanel game={game} heroIndex={hero} />
      <HandLog history={view.history} players={game.players} heroIndex={hero} />
    </>
  ) : (
    <SeatList seats={view.seats} you={you} />
  );

  const heroClock =
    view.turn && you !== null && view.turn.player === you
      ? { startedAt: view.turn.startedAt, decisionMs: view.turn.decisionMs, bankMs: view.turn.bankMs }
      : null;
  const tableClock = view.turn
    ? { turn: { key: `${game?.handNumber}:${view.step}`, player: view.turn.player, startedAt: view.turn.startedAt }, decisionMs: view.turn.decisionMs, bankMs: view.turn.bankMs }
    : null;

  const heroPlace = game && you !== null ? game.players[you].place : null;
  const showResult = !dismissedResult && game !== null && !view.runout && (view.phase === "finished" || heroPlace !== null);

  const idleText =
    view.phase === "lobby"
      ? ranked
        ? "Waiting for everyone to connect"
        : "Waiting for the host to start"
      : !game || game.handNumber === 0
        ? "Shuffling up"
        : view.runout
          ? "All in. Running it out"
          : game.phase === "complete"
            ? "Next hand coming up"
            : you === null
              ? "Spectating"
              : game.players[you].folded
                ? "You folded. Waiting for the hand to finish"
                : `Waiting on ${game.toAct !== null ? game.players[game.toAct].name : "the table"}`;

  const nextLevelText = game
    ? game.handNumber === 0
      ? describeLevelLength(config)
      : game.handsLeftInLevel <= 1
        ? "after this hand"
        : `in ${game.handsLeftInLevel} hands`
    : describeLevelLength(config);
  const blinds = game?.blinds ?? blindsForLevel(0);
  const next = blindsForLevel((game?.level ?? 0) + 1);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-deep px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-[13px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary">
            <span aria-hidden>‹</span> <span className="max-sm:hidden">Lobby</span>
          </Link>
          <div className="h-5 w-px shrink-0 bg-border max-sm:hidden" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-[15px] font-semibold leading-tight">{config.name} table</span>
              <button
                onClick={copyLink}
                className="rounded border border-border px-1.5 font-display text-[12px] font-semibold tracking-wider text-gold transition hover:bg-white/5"
                title="Copy invite link"
              >
                {copied ? "Copied" : code}
              </button>
            </div>
            <div className={`truncate text-[11px] ${ranked ? "text-gold" : "text-text-tertiary"}`}>
              {ranked ? "Ranked, rating on the line" : "Private, unrated"}
              {status !== "open" ? " · reconnecting" : ""}
            </div>
          </div>
        </div>
        <dl className="flex shrink-0 items-center gap-4 text-[12px] sm:gap-6">
          <div className="text-right">
            <dt className="text-text-tertiary">Blinds</dt>
            <dd className="font-display text-[15px] font-semibold tabular-nums">
              {formatHp(blinds.sb)}/{formatHp(blinds.bb)}
            </dd>
          </div>
          <div className="text-right max-md:hidden">
            <dt className="text-text-tertiary">Next level</dt>
            <dd className="tabular-nums text-text-secondary">
              {formatHp(next.sb)}/{formatHp(next.bb)} {nextLevelText}
            </dd>
          </div>
          <button onClick={() => setDrawerOpen(true)} className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary lg:hidden">
            {game ? "Standings" : "Seats"}
          </button>
          <SoundToggle className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-border text-text-secondary transition hover:bg-white/5 hover:text-text-primary" />
          <SettingsButton className="rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary">
            <span className="max-sm:hidden">Settings</span>
            <span className="sm:hidden" aria-label="Settings">⚙</span>
          </SettingsButton>
        </dl>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-2 sm:p-4">
          <div className="min-h-0 flex-1">
            {view.cancelled ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="font-display text-[24px] font-semibold">Match called off</div>
                <p className="max-w-[44ch] text-[14px] text-text-secondary">{view.cancelled}</p>
                <Link href="/" className="rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110">
                  Back to lobby
                </Link>
              </div>
            ) : game ? (
              <PokerTable
                game={game}
                heroIndex={hero}
                stats={stats}
                clock={tableClock}
                runout={view.runout}
                heroSittingOut={!!heroSeat?.sittingOut}
                botLabel={`${BOT_LEVELS[view.config.botLevel].name} bot`}
                titles={view.seats.map((s) => s.title)}
                avatars={view.seats.map((s) => s.avatar)}
                botLabels={view.seats.map((s) => (s.botLevel ? `${BOT_LEVELS[s.botLevel].name} bot` : null))}
              />
            ) : ranked ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <div className="font-display text-[24px] font-semibold">Match found</div>
                <p className="text-[14px] text-text-secondary">
                  {view.seats.filter((s) => !s.connected).length ? "Waiting for your opponent to connect" : "Dealing"}
                </p>
              </div>
            ) : (
              <LobbyTable
                view={view}
                you={you}
                isHost={isHost}
                canManage={canManage}
                onSit={sit}
                onStand={stand}
                onStart={start}
                onAddBot={addBot}
                onKick={kick}
                onUnblock={unblock}
                onSetSeats={setSeats}
                onSetMod={setMod}
                onCopy={copyLink}
                copied={copied}
              />
            )}
          </div>
          {/* The action bar only matters once cards are dealt; the lobby keeps the space. Errors still show above it. */}
          <div className={`relative mx-auto w-full max-w-[880px] shrink-0 ${game ? ACTION_BAR_SLOT : ""}`}>
            {error && <div className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-lg border border-red/40 bg-surface-deep px-3 py-2 text-[13px] text-[#EFA3A3]">{error}</div>}
            {!game ? null : heroSeat?.sittingOut && game.phase !== "finished" ? (
              <div className="flex h-full items-center justify-between gap-3 rounded-xl border border-gold/50 bg-gold/[0.07] px-4">
                <div>
                  <div className="font-display text-[15px] font-semibold text-gold">You&apos;re sitting out</div>
                  <div className="text-[12px] text-text-secondary">
                    {ranked && view.away !== undefined
                      ? view.away >= abandonHands(view.config.mode)
                        ? `Away ${view.away} hands: you can no longer finish in the top half. You check when you can and fold to bets.`
                        : `Away ${view.away} of ${abandonHands(view.config.mode)} hands. Any more and you can't finish in the top half.`
                      : "Your clock ran out. Until you return, you check when you can and fold to bets."}
                  </div>
                </div>
                <button onClick={back} className="shrink-0 rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary transition hover:brightness-110">
                  I&apos;m back
                </button>
              </div>
            ) : (
              <ActionBar
                legal={view.legal}
                pot={game ? potTotal(game) : 0}
                currentBet={game?.currentBet ?? 0}
                bigBlind={blinds.bb}
                preflop={game?.street === "preflop"}
                onAct={act}
                idleText={idleText}
                clock={heroClock}
              />
            )}
          </div>
          {showResult && game && (
            <ResultOverlay
              game={game}
              heroIndex={hero}
              finished={view.phase === "finished"}
              online
              ranked={ranked ? { change: myUserId ? view.ratingChanges?.[myUserId] : undefined, penalized: !!myUserId && !!view.penalized?.includes(myUserId) } : undefined}
              achievements={myUserId ? view.achievements?.[myUserId] : undefined}
              onWatch={() => setDismissedResult(true)}
              onSkip={() => setDismissedResult(true)}
              playAgainLabel={ranked && view.ratingChanges ? "Find another match" : undefined}
              onPlayAgain={() => router.push(`/?queue=${view.config.mode}`)}
            />
          )}
        </main>
        <aside className="flex min-h-0 w-[280px] shrink-0 flex-col border-l border-border bg-surface-deep max-lg:hidden">{sidebar}</aside>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col border-l border-border bg-surface-deep" style={{ animation: "drawer-in 220ms ease-out both" }}>
            <div className="flex items-center justify-end px-2 pt-2">
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="rounded-md px-2 text-[20px] leading-none text-text-secondary hover:bg-white/5 hover:text-text-primary">×</button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}

function statsFrom(view: TableView | null): StatsTable {
  if (!view?.game) return {};
  let table: StatsTable = {};
  for (const h of view.history) {
    if (!h.events.some((e) => e.kind === "win")) continue;
    const dealt: Record<number, string> = {};
    view.game.players.forEach((p, i) => {
      if (h.events.some((e) => (e.kind === "post" || e.kind === "action") && e.player === i)) dealt[i] = p.id;
    });
    table = accumulateHand(table, h.events, dealt);
  }
  return table;
}

function Notice({
  title,
  body,
  link,
  action,
}: {
  title: string;
  body?: string;
  link?: { href: string; label: string };
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-display text-[22px] font-semibold">{title}</div>
      {body && <p className="max-w-[40ch] text-[14px] text-text-secondary">{body}</p>}
      <div className="flex gap-2">
        {action && (
          <button onClick={action.onClick} className="rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110">
            {action.label}
          </button>
        )}
        {link && (
          <Link
            href={link.href}
            className={
              action
                ? "rounded-lg border border-border px-4 py-2.5 text-[14px] text-text-secondary hover:bg-white/5"
                : "rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110"
            }
          >
            {link.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function SeatList({ seats, you }: { seats: SeatView[]; you: number | null }) {
  return (
    <section className="p-4">
      <h2 className="mb-3 font-display text-[14px] font-semibold">Seats</h2>
      <ol className="flex flex-col gap-1.5">
        {seats.map((s) => (
          <li key={s.index} className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] ${s.index === you ? "bg-gold/[0.07]" : ""}`}>
            <span className="w-4 text-center text-text-tertiary">{s.index + 1}</span>
            {s.userId ? (
              <>
                <Avatar name={s.name} avatar={s.avatar} size={20} />
                <span className={`flex-1 truncate ${s.index === you ? "font-medium text-gold" : "text-text-primary"}`}>{s.name}</span>
                <PlayerTitle id={s.title} size={8.5} className="max-w-[90px]" />
                <RoleBadge seat={s} size="sm" />
                {!s.connected && <span className="text-[10px] text-red-muted">away</span>}
              </>
            ) : s.isBot ? (
              <>
                <BotIcon size={20} color={BOT_LEVEL_COLORS[s.botLevel ?? "medium"]} />
                <span className="flex-1 truncate text-text-secondary">{s.name}</span>
                <span className="text-[10px] text-text-tertiary">{BOT_LEVELS[s.botLevel ?? "medium"].name} bot</span>
              </>
            ) : (
              <span className="flex-1 text-text-tertiary">Open seat</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Host (gold) and co-host (felt) markers. */
function RoleBadge({ seat, size = "md" }: { seat: SeatView; size?: "sm" | "md" }) {
  if (!seat.isHost && !seat.isMod) return null;
  const text = size === "sm" ? "text-[9px]" : "text-[9.5px]";
  return seat.isHost ? (
    <span className={`rounded-full border border-gold/40 px-1.5 font-semibold uppercase tracking-wider text-gold ${text}`}>Host</span>
  ) : (
    <span className={`rounded-full border border-felt-light/40 px-1.5 font-semibold uppercase tracking-wider text-felt-light ${text}`}>Co-host</span>
  );
}

function LobbyTable({
  view,
  you,
  isHost,
  canManage,
  onSit,
  onStand,
  onStart,
  onAddBot,
  onKick,
  onUnblock,
  onSetSeats,
  onSetMod,
  onCopy,
  copied,
}: {
  view: TableView;
  you: number | null;
  isHost: boolean;
  canManage: boolean;
  onSit: () => void;
  onStand: () => void;
  onStart: () => void;
  onAddBot: (level: BotLevel) => void;
  onKick: (seat: number, block?: boolean) => void;
  onUnblock: (userId: string) => void;
  onSetSeats: (n: number) => void;
  onSetMod: (userId: string, on: boolean) => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const total = view.seats.length;
  const seated = view.seats.filter((s) => s.userId || s.isBot).length;
  const open = total - seated;
  // Rows that divide evenly: one row up to 7 seats, then 4+4 and 3+3+3.
  const cols = total <= 7 ? total : total === 8 ? 4 : 3;
  const btn = "rounded-md border border-border px-2.5 py-1 text-[12px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    // Scrolls when it doesn't fit (phones, big tables); m-auto keeps it centered when it does.
    <div className="flex h-full overflow-y-auto">
      <div className="m-auto flex w-full flex-col items-center gap-5 py-2 text-center">
        <div>
          <div className="font-display text-[26px] font-semibold tracking-tight max-sm:text-[22px]">Waiting for players</div>
          <div className="mt-1.5 flex justify-center">
            {isHost ? (
              <span className="rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-gold">You&apos;re hosting</span>
            ) : (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11.5px] text-text-secondary">Hosted by {view.hostName ?? "a friend"}</span>
            )}
          </div>
        </div>

        {/* Access code */}
        <div className="flex items-stretch overflow-hidden rounded-xl border border-gold/40 bg-surface-deep">
          <div className="flex flex-col justify-center px-4 py-2.5 text-left">
            <span className="text-[10.5px] uppercase tracking-wider text-text-tertiary">Table code</span>
            <span className="font-display text-[26px] font-semibold leading-none tracking-[0.18em] text-gold">{view.config.code}</span>
          </div>
          <button onClick={onCopy} className="border-l border-gold/30 px-4 text-[12.5px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary" title="Copy invite link">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        {/* Phones get three columns of narrower cards; wider screens keep rows that divide evenly. */}
        <div
          className="grid w-full justify-center gap-2 [grid-template-columns:repeat(var(--cols),124px)] max-sm:[grid-template-columns:repeat(3,minmax(0,1fr))]"
          style={{ "--cols": cols } as React.CSSProperties}
        >
          {view.seats.map((s) => {
            const kickable = canManage && (s.userId || s.isBot) && !s.isHost && s.index !== you && (!s.isMod || isHost);
            return (
              <div key={s.index} className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border p-3 max-sm:p-2 ${s.userId || s.isBot ? "border-border bg-surface-deep" : "border-dashed border-white/15"}`}>
                {kickable && (
                  <button
                    onClick={() => onKick(s.index)}
                    aria-label={`Remove ${s.name}`}
                    title="Remove from table"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-primary text-[12px] leading-none text-text-tertiary hover:border-red/50 hover:text-[#EFA3A3]"
                  >
                    ×
                  </button>
                )}
                {s.userId ? (
                  <>
                    <Avatar name={s.name} avatar={s.avatar} size={36} ring={s.index === you ? "gold" : "none"} />
                    <span className="max-w-full truncate text-[12px] font-medium">{s.name}</span>
                    {s.isHost || s.isMod ? <RoleBadge seat={s} /> : <span className="text-[10px] text-text-tertiary">{s.connected ? "Ready" : "Away"}</span>}
                    {isHost && !s.isHost && (
                      <span className="flex flex-wrap justify-center gap-x-2 text-[10px] text-text-tertiary">
                        <button onClick={() => onSetMod(s.userId!, !s.isMod)} className="underline-offset-2 hover:text-text-primary hover:underline">
                          {s.isMod ? "Remove co-host" : "Make co-host"}
                        </button>
                        <button onClick={() => onKick(s.index, true)} title="Remove and don't let them sit again until you invite them back" className="underline-offset-2 hover:text-[#EFA3A3] hover:underline">
                          Block
                        </button>
                      </span>
                    )}
                  </>
                ) : s.isBot ? (
                  <>
                    <BotIcon size={36} color={BOT_LEVEL_COLORS[s.botLevel ?? "medium"]} />
                    <span className="max-w-full truncate text-[12px] font-medium text-text-secondary">{s.name}</span>
                    <span className="text-[10px]" style={{ color: BOT_LEVEL_COLORS[s.botLevel ?? "medium"] }}>{BOT_LEVELS[s.botLevel ?? "medium"].name} bot</span>
                  </>
                ) : (
                  <>
                    <div className="h-9 w-9 rounded-full border border-dashed border-white/20" />
                    <span className="text-[12px] text-text-tertiary">Open</span>
                    <span className="text-[10px] text-text-tertiary">&nbsp;</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {canManage && open > 0 && (
          <InviteFriends
            code={view.config.code}
            modeId={view.config.mode}
            seatedIds={[...view.seats.map((s) => s.userId).filter((id): id is string => !!id), ...view.blocked.map((b) => b.userId)]}
          />
        )}
        {isHost && view.blocked.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-[12px] text-text-tertiary">
            <span>Blocked:</span>
            {view.blocked.map((b) => (
              <span key={b.userId} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5">
                <span className="text-text-secondary">{b.name}</span>
                <button
                  onClick={async () => {
                    onUnblock(b.userId);
                    await sendInvite(b.userId, view.config.code, view.config.mode);
                  }}
                  className="text-gold underline-offset-2 hover:underline"
                >
                  Invite back
                </button>
              </span>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-deep px-3 py-2 text-[13px]">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-text-secondary">Add bot</span>
              {(Object.keys(BOT_LEVELS) as BotLevel[]).map((level) => (
                <button key={level} onClick={() => onAddBot(level)} disabled={open === 0} className={btn} title={BOT_LEVELS[level].blurb}>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: BOT_LEVEL_COLORS[level] }} />
                  {BOT_LEVELS[level].name}
                </button>
              ))}
            </div>
            {isHost && (
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-text-secondary">Seats</span>
                <button onClick={() => onSetSeats(total - 1)} disabled={total <= 2 || open === 0} aria-label="Fewer seats" className={`${btn} h-7 w-7 px-0`}>
                  −
                </button>
                <span className="w-4 text-center font-display text-[15px] font-semibold tabular-nums">{total}</span>
                <button onClick={() => onSetSeats(total + 1)} disabled={total >= MAX_SEATS} aria-label="More seats" className={`${btn} h-7 w-7 px-0`}>
                  +
                </button>
              </div>
            )}
            <span className="text-text-tertiary">{seated} of {total} seats taken</span>
          </div>
        )}

        <div className="flex gap-2">
          {you === null ? (
            <button onClick={onSit} disabled={open === 0} className="rounded-lg bg-gold px-5 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110 disabled:opacity-50">
              Take a seat
            </button>
          ) : (
            <button onClick={onStand} className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-text-secondary hover:bg-white/5 hover:text-text-primary">
              Leave seat
            </button>
          )}
          {isHost && (
            <button
              onClick={onStart}
              disabled={seated < 2}
              className="rounded-lg bg-felt px-5 py-2.5 font-display text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              Start with {seated} {seated === 1 ? "player" : "players"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
