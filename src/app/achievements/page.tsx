import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AchievementBadge } from "@/components/ui/AchievementBadge";
import { MobileTopBar } from "@/components/lobby/MobileTopBar";
import { NavRail } from "@/components/lobby/NavRail";
import { getAccount } from "@/lib/account";
import { type AchievementCategory, ACHIEVEMENTS } from "@/lib/achievements";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Achievements · Holdemics" };

const SECTIONS: { id: AchievementCategory; title: string; blurb: string }[] = [
  { id: "game", title: "At the table", blurb: "Earned in ranked games, or private games with no bots at the table." },
  { id: "milestone", title: "Milestones", blurb: "Ranked games played and won." },
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
          {earned.size} of {ACHIEVEMENTS.length} earned. Practice games against bots never count, so none of these can be farmed.
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
                return (
                  <li key={a.id} className={`flex items-center gap-3 rounded-xl border p-3 ${at ? "border-gold/50 bg-gold/[0.05]" : "border-border bg-surface-primary opacity-70"}`}>
                    <AchievementBadge achievement={a} earned={!!at} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium">{a.name}</div>
                      <div className="text-[12.5px] text-text-secondary">{a.description}</div>
                      {at && <div className="mt-0.5 text-[11px] text-gold">Earned {new Date(at).toLocaleDateString()}</div>}
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
