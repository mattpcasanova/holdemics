"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SettingsButton } from "@/components/ui/SettingsDialog";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { useTableSocket } from "@/hooks/useTableSocket";
import { BOT_LEVELS } from "@/lib/engine/bots";
import { potTotal } from "@/lib/engine/game";
import { MODES, blindsForLevel, describeLevelLength, formatHp } from "@/lib/engine/modes";
import { type StatsTable, accumulateHand } from "@/lib/stats";
import { InviteFriends } from "@/components/friends/InviteFriends";
import type { SeatView, TableView } from "@/lib/realtime/protocol";
import { ActionBar } from "./ActionBar";
import { HandLog } from "./HandLog";
import { PokerTable } from "./PokerTable";
import { ResultOverlay } from "./ResultOverlay";
import { StandingsPanel } from "./StandingsPanel";

interface OnlineTableProps {
  code: string;
  serverWs: string;
}

export function OnlineTable({ code, serverWs }: OnlineTableProps) {
  const { view, status, error, clearError, act, sit, stand, start, back } = useTableSocket(code, serverWs);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissedResult, setDismissedResult] = useState(false);

  // Per-player stats from the hands we've seen (cheap enough to recompute per view).
  const stats = statsFrom(view);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  if (status === "unauthorized") return <Notice title="Sign in to join this table" link={{ href: `/login?next=/table/${code}`, label: "Sign in" }} />;
  if (status === "missing") return <Notice title="This table doesn't exist" body="Check the code with whoever sent it." link={{ href: "/", label: "Back to lobby" }} />;
  if (!view) return <Notice title={status === "closed" ? "Reconnecting to the table" : "Joining the table"} />;

  const config = MODES[view.config.mode];
  const you = view.you;
  const hero = you ?? 0;
  const game = view.game;
  const seatedHumans = view.seats.filter((s) => s.userId).length;
  const isHost = view.seats.some((s) => s.isHost && s.index === you);
  const heroSeat = you !== null ? view.seats[you] : null;
  const ranked = !!view.config.ranked;
  const myUserId = heroSeat?.userId ?? null;

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
              />
            ) : ranked ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <div className="font-display text-[24px] font-semibold">Match found</div>
                <p className="text-[14px] text-text-secondary">
                  {view.seats.filter((s) => !s.connected).length ? "Waiting for your opponent to connect" : "Dealing"}
                </p>
              </div>
            ) : (
              <LobbyTable view={view} you={you} isHost={isHost} onSit={sit} onStand={stand} onStart={start} seatedHumans={seatedHumans} />
            )}
          </div>
          <div className="mx-auto w-full max-w-[880px] shrink-0">
            {error && <div className="mb-2 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-[13px] text-[#EFA3A3]">{error}</div>}
            {heroSeat?.sittingOut && game && game.phase !== "finished" ? (
              <div className="flex h-[64px] items-center justify-between gap-3 rounded-xl border border-gold/50 bg-gold/[0.07] px-4 sm:h-[112px]">
                <div>
                  <div className="font-display text-[15px] font-semibold text-gold">You&apos;re sitting out</div>
                  <div className="text-[12px] text-text-secondary">Your clock ran out. Until you return, you check when you can and fold to bets.</div>
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
              ranked={ranked ? { change: myUserId ? view.ratingChanges?.[myUserId] : undefined } : undefined}
              achievements={myUserId ? view.achievements?.[myUserId] : undefined}
              onWatch={() => setDismissedResult(true)}
              onSkip={() => setDismissedResult(true)}
              onPlayAgain={() => setDismissedResult(true)}
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

function Notice({ title, body, link }: { title: string; body?: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="font-display text-[22px] font-semibold">{title}</div>
      {body && <p className="max-w-[40ch] text-[14px] text-text-secondary">{body}</p>}
      {link && (
        <Link href={link.href} className="rounded-lg bg-gold px-4 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110">
          {link.label}
        </Link>
      )}
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
                <Avatar name={s.name} size={20} />
                <span className={`flex-1 truncate ${s.index === you ? "font-medium text-gold" : "text-text-primary"}`}>{s.name}</span>
                {s.isHost && <span className="text-[10px] text-text-tertiary">host</span>}
                {!s.connected && <span className="text-[10px] text-red-muted">away</span>}
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

/** The table before the first deal: who's seated, and the host's start button. */
function LobbyTable({
  view,
  you,
  isHost,
  seatedHumans,
  onSit,
  onStand,
  onStart,
}: {
  view: TableView;
  you: number | null;
  isHost: boolean;
  seatedHumans: number;
  onSit: () => void;
  onStand: () => void;
  onStart: () => void;
}) {
  const config = MODES[view.config.mode];
  const open = view.seats.length - seatedHumans;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <div>
        <div className="font-display text-[26px] font-semibold tracking-tight">Waiting for players</div>
        <p className="mt-1 max-w-[46ch] text-[14px] text-text-secondary">
          Share the code <span className="font-display font-semibold text-gold">{view.config.code}</span> or the page link. {seatedHumans} of {view.seats.length} seats taken
          {open > 0 ? `; empty seats get ${BOT_LEVELS[view.config.botLevel].name} bots when the game starts.` : "."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {view.seats.map((s) => (
          <div key={s.index} className={`flex w-[120px] flex-col items-center gap-1.5 rounded-xl border p-3 ${s.userId ? "border-border bg-surface-deep" : "border-dashed border-white/15"}`}>
            {s.userId ? (
              <>
                <Avatar name={s.name} size={36} ring={s.index === you ? "gold" : "none"} />
                <span className="max-w-full truncate text-[12px] font-medium">{s.name}</span>
                <span className="text-[10px] text-text-tertiary">{s.isHost ? "Host" : s.connected ? "Ready" : "Away"}</span>
              </>
            ) : (
              <>
                <div className="h-9 w-9 rounded-full border border-dashed border-white/20" />
                <span className="text-[12px] text-text-tertiary">Open</span>
                <span className="text-[10px] text-text-tertiary">&nbsp;</span>
              </>
            )}
          </div>
        ))}
      </div>
      {open > 0 && <InviteFriends code={view.config.code} modeId={view.config.mode} seatedIds={view.seats.map((s) => s.userId).filter((id): id is string => !!id)} />}
      <div className="flex gap-2">
        {you === null ? (
          <button onClick={onSit} className="rounded-lg bg-gold px-5 py-2.5 font-display text-[14px] font-semibold text-surface-primary hover:brightness-110">
            Take a seat
          </button>
        ) : (
          <button onClick={onStand} className="rounded-lg border border-border px-4 py-2.5 text-[13px] text-text-secondary hover:bg-white/5 hover:text-text-primary">
            Leave seat
          </button>
        )}
        {isHost && (
          <button onClick={onStart} className="rounded-lg bg-felt px-5 py-2.5 font-display text-[14px] font-semibold text-white hover:brightness-110">
            Start {config.name}
          </button>
        )}
      </div>
    </div>
  );
}
