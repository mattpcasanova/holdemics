import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AchievementBadge } from "@/components/ui/AchievementBadge";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { getAccount } from "@/lib/account";
import { type AchievementCategory, ACHIEVEMENTS, rewardName } from "@/lib/achievements";
import { RARITY } from "@/lib/cosmetics";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Achievements · Holdemics" };

const SECTIONS: { id: AchievementCategory; title: string; blurb: string }[] = [
  { id: "comeback", title: "Comeback", blurb: "Win after being nearly out. The lower you got, the rarer the badge." },
  { id: "domination", title: "Domination", blurb: "Win an 8-player game as the sole chip leader, from earlier and earlier." },
  { id: "bounty", title: "Bounty", blurb: "Be the one who takes the last of their chips." },
  { id: "table", title: "At the table", blurb: "Things that happen in a single game." },
  { id: "milestone", title: "Milestones", blurb: "Ranked games played, won, and won in a row." },
  { id: "tier", title: "Tiers", blurb: "Reach a tier in any mode." },
];

export default async function AchievementsPage() {
  const account = await getAccount();
  if (!account) redirect("/login?next=/achievements");
  const supabase = await createClient();
  const { data } = await supabase.from("player_achievements").select("achievement_id, earned_at").eq("user_id", account.profile.id);
  const earned = new Map((data ?? []).map((r) => [r.achievement_id as string, r.earned_at as string]));

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <NavRail active="Achievements" profile={account.profile} />
      <MobileTopBar profile={account.profile} />
      <div className="mx-auto w-full max-w-[1000px] p-4 sm:p-6">
        <h1 className="mb-1 font-display text-[28px] font-semibold tracking-tight">Achievements</h1>
        <p className="mb-6 text-[14px] text-text-secondary">
          {earned.size} of {ACHIEVEMENTS.length} earned. Every one unlocks a title, card back, or table; the rarer the achievement, the better the
          reward. Games with bots at the table never count. Pick what you wear in Settings.
        </p>
        {SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`ach-${section.id}`} className="mb-8">
            <h2 id={`ach-${section.id}`} className="font-display text-[18px] font-semibold">
              {section.title}
            </h2>
            <p className="mb-3 text-[13px] text-text-secondary">{section.blurb}</p>
            <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {ACHIEVEMENTS.filter((a) => a.category === section.id).map((a) => {
                const at = earned.get(a.id);
                const rarity = RARITY[a.rarity];
                return (
                  <li
                    key={a.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${at ? "bg-white/[0.03]" : "border-border bg-surface-primary opacity-70"}`}
                    style={at ? { borderColor: `${rarity.color}80` } : undefined}
                  >
                    <AchievementBadge achievement={a} earned={!!at} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium">{a.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: rarity.color }}>
                          {rarity.label}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-text-secondary">{a.description}</div>
                      <div className="mt-0.5 text-[11px] text-text-tertiary">
                        {rewardName(a.reward)}
                        {at && <span className="text-gold"> · Earned {new Date(at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
