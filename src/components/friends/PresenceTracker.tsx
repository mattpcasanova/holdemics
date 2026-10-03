"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AchievementBadge } from "@/components/ui/AchievementBadge";
import { RewardPreview } from "@/components/ui/RewardPreview";
import { ACHIEVEMENT_BY_ID } from "@/lib/achievements";
import { RARITY } from "@/lib/cosmetics";
import { type ModeId, MODES } from "@/lib/engine/modes";
import { equipReward, isEquipped } from "@/lib/equip";
import {
  type ActiveGame,
  type FriendNotice,
  type Where,
  answerFriendRequest,
  dismissAchievement,
  dismissFriendNotice,
  dismissInvite,
  trackPresence,
  useAchievementNotices,
  refreshActiveGame,
  useActiveGame,
  useFriendNotices,
  useInvites,
} from "@/lib/presence";

const ACCEPTED_NOTICE_MS = 8000;
const REQUEST_NOTICE_MS = 15000;
const ACHIEVEMENT_NOTICE_MS = 20000;

const TOAST = "flex items-center gap-3 rounded-xl border bg-surface-primary px-4 py-3 shadow-2xl";
const pop = { animation: "pop-in 200ms ease-out both" };

/** Hide a toast after `ms`, pausing while the pointer is over it. */
function useAutoDismiss(ms: number | null, dismiss: () => void) {
  const [hovered, setHovered] = useState(false);
  // Keep the latest callback without restarting the timer on every render.
  const latest = useRef(dismiss);
  useEffect(() => {
    latest.current = dismiss;
  });
  useEffect(() => {
    if (ms === null || hovered) return;
    const timer = setTimeout(() => latest.current(), ms);
    return () => clearTimeout(timer);
  }, [ms, hovered]);
  return { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) };
}

/**
 * Announces where the signed-in player is, and shows table invites, friend
 * notices, and achievements. At a table nothing here navigates away (that
 * would abandon the game); elsewhere a pill leads back to an unfinished one.
 */
export function PresenceTracker({ userId, username }: { userId: string; username: string }) {
  const pathname = usePathname();
  const invites = useInvites();
  const achievements = useAchievementNotices();
  const activeGame = useActiveGame();
  const inGame = pathname.startsWith("/table/") || pathname.startsWith("/practice");
  // The Friends page already lists incoming requests, so don't toast them there.
  const notices = useFriendNotices().filter((n) => !(n.kind === "request" && pathname === "/friends"));
  const awayFromTable = activeGame && !pathname.toUpperCase().startsWith(`/TABLE/${activeGame.code}`);

  // Check for an unfinished game on every page and whenever the tab comes back into focus.
  useEffect(() => {
    void refreshActiveGame(userId);
  }, [pathname, userId]);
  useEffect(() => {
    const onFocus = () => void refreshActiveGame(userId);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId]);

  useEffect(() => {
    const table = pathname.match(/^\/table\/([A-Z0-9]+)/i);
    const where: Where = table ? `table:${table[1].toUpperCase()}` : pathname.startsWith("/practice") ? "practice" : "lobby";
    void trackPresence({ userId, username, where });
  }, [pathname, userId, username]);

  // At a table the action buttons sit along the bottom, so notices drop in at the top instead.
  const placement = inGame ? "inset-x-4 top-3 items-center" : "bottom-4 right-4 items-end max-md:bottom-[calc(76px+env(safe-area-inset-bottom))] max-sm:left-4 max-sm:items-stretch";
  const hasToasts = invites.length > 0 || notices.length > 0 || achievements.length > 0;
  const toasts = hasToasts && (
    <div className={`pointer-events-none fixed z-[120] flex flex-col gap-2 [&>*]:pointer-events-auto ${placement}`}>
      {achievements.map((id) => (
        <AchievementToast key={id} id={id} />
      ))}
      {notices.map((notice) => (
        <FriendToast key={notice.id} notice={notice} inGame={inGame} />
      ))}
      {invites.map((invite) => (
        <div key={invite.id} role="status" className={`${TOAST} border-gold/50`} style={pop}>
          <div>
            <div className="text-[13px] font-medium">
              <span className="text-gold">{invite.fromName}</span> invited you to a {MODES[invite.mode as ModeId]?.name ?? invite.mode} table
            </div>
            <div className="text-[11.5px] text-text-tertiary">Code {invite.code}</div>
          </div>
          <Link
            href={`/table/${invite.code}`}
            onClick={() => dismissInvite(invite.id)}
            className="rounded-lg bg-gold px-3 py-1.5 font-display text-[13px] font-semibold text-surface-primary hover:brightness-110"
          >
            Join
          </Link>
          <button onClick={() => dismissInvite(invite.id)} aria-label="Dismiss" className="text-[18px] leading-none text-text-tertiary hover:text-text-primary">
            ×
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {awayFromTable && <RejoinBanner game={activeGame} />}
      {toasts}
    </>
  );
}

/** Full-width bar on every page while the player has an unfinished game elsewhere. */
function RejoinBanner({ game }: { game: ActiveGame }) {
  const mode = MODES[game.mode as ModeId]?.name ?? game.mode;
  return (
    <Link
      href={`/table/${game.code}`}
      className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-felt px-4 py-2.5 text-white shadow-lg hover:brightness-110"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
      </span>
      <span className="text-[13.5px]">
        {`You're still in a ${game.ranked ? "ranked " : ""}${mode} game. Your hands are being folded while you're away.`}
      </span>
      <span className="shrink-0 rounded-md bg-white px-3 py-1 font-display text-[13px] font-semibold text-felt">Rejoin</span>
    </Link>
  );
}

function FriendToast({ notice, inGame }: { notice: FriendNotice; inGame: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = notice.kind === "request";
  const dismiss = () => dismissFriendNotice(notice.id);
  // The request stays on the Friends page and in the nav badge after the toast goes.
  const hover = useAutoDismiss(request ? REQUEST_NOTICE_MS : ACCEPTED_NOTICE_MS, dismiss);

  const answer = async (accept: boolean) => {
    setBusy(true);
    const err = await answerFriendRequest(notice.userId, accept);
    setBusy(false);
    if (err) setError(err);
  };

  // Outside a game, the toast opens the Friends page and the name opens their profile.
  const open = inGame ? undefined : () => {
    dismiss();
    router.push("/friends");
  };
  const name = inGame ? (
    <span className="text-gold">{notice.username}</span>
  ) : (
    <Link href={`/u/${encodeURIComponent(notice.username)}`} onClick={(e) => { e.stopPropagation(); dismiss(); }} className="text-gold hover:underline">
      {notice.username}
    </Link>
  );

  return (
    <div role="status" className={`${TOAST} border-gold/50 ${open ? "cursor-pointer" : ""}`} style={pop} onClick={open} {...hover}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">
          {name} {request ? "sent you a friend request" : "accepted your friend request"}
        </div>
        {error && <div className="text-[11.5px] text-[#EFA3A3]">{error}</div>}
        {!error && !inGame && <div className="text-[11.5px] text-text-tertiary">{request ? "Open friend requests" : "Open friends"}</div>}
      </div>
      {request && (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => answer(true)}
            disabled={busy}
            className="rounded-lg bg-gold px-3 py-1.5 font-display text-[13px] font-semibold text-surface-primary hover:brightness-110 disabled:opacity-60"
          >
            Accept
          </button>
          <button
            onClick={() => answer(false)}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-secondary hover:bg-white/5 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        aria-label="Dismiss"
        className="text-[18px] leading-none text-text-tertiary hover:text-text-primary"
      >
        ×
      </button>
    </div>
  );
}

const REWARD_KIND = { title: "Title", cardBack: "Card back", table: "Table" } as const;

function AchievementToast({ id }: { id: string }) {
  const achievement = ACHIEVEMENT_BY_ID.get(id);
  const [state, setState] = useState<"idle" | "busy" | "on" | string>(() => (achievement && isEquipped(achievement.reward) ? "on" : "idle"));
  const dismiss = () => dismissAchievement(id);
  const hover = useAutoDismiss(ACHIEVEMENT_NOTICE_MS, dismiss);
  if (!achievement) return null;
  const rarity = RARITY[achievement.rarity];

  const equip = async () => {
    setState("busy");
    const err = await equipReward(achievement.reward);
    setState(err ?? "on");
  };

  return (
    <div role="status" className={`${TOAST} max-w-[460px] pr-3`} style={{ ...pop, borderColor: rarity.color }} {...hover}>
      <AchievementBadge achievement={achievement} earned size={40} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold" style={{ color: rarity.color }}>
          {rarity.label} achievement unlocked
        </div>
        <div className="font-display text-[15px] font-semibold leading-tight">{achievement.name}</div>
        <div className="text-[11.5px] text-text-tertiary">{achievement.description}</div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5 border-l border-border pl-3">
        <div className="text-[10px] text-text-tertiary">{REWARD_KIND[achievement.reward.kind]}</div>
        <div className="flex min-h-[28px] items-center">
          <RewardPreview reward={achievement.reward} titleSize={13} />
        </div>
        {state === "on" ? (
          <span className="text-[11.5px] font-medium text-felt-light">Using it</span>
        ) : (
          <button
            onClick={equip}
            disabled={state === "busy"}
            className="rounded-md bg-gold px-2.5 py-1 font-display text-[12px] font-semibold text-surface-primary hover:brightness-110 disabled:opacity-60"
          >
            Use it
          </button>
        )}
        {state !== "idle" && state !== "busy" && state !== "on" && <span className="max-w-[110px] text-center text-[10.5px] text-[#EFA3A3]">{state}</span>}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="self-start text-[18px] leading-none text-text-tertiary hover:text-text-primary">
        ×
      </button>
    </div>
  );
}
