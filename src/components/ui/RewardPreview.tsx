import { PlayingCard } from "@/components/table/PlayingCard";
import { PlayerTitle } from "@/components/ui/PlayerTitle";
import type { Reward } from "@/lib/achievements";
import { type TableSkin, TABLE_SKINS } from "@/lib/cosmetics";

/** A small oval of a table skin's rail and felt. */
export function TablePreview({ skin }: { skin: TableSkin }) {
  return (
    <div className="mx-auto h-11 w-[84px] rounded-[50%] p-[4px]" style={{ background: `linear-gradient(180deg, ${skin.rail[0]}, ${skin.rail[1]})` }}>
      <div
        className="h-full w-full rounded-[50%]"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${skin.felt[0]} 0%, ${skin.felt[1]} 35%, ${skin.felt[2]} 72%, ${skin.felt[3]} 100%)`,
          boxShadow: `inset 0 0 0 1px ${skin.inlay}`,
        }}
      />
    </div>
  );
}

/** What an achievement's reward looks like: the title as worn, the card back, or the table. */
export function RewardPreview({ reward, titleSize = 12 }: { reward: Reward; titleSize?: number }) {
  if (reward.kind === "title") return <PlayerTitle id={reward.id} size={titleSize} wrap />;
  if (reward.kind === "cardBack") return <PlayingCard faceDown size="sm" backSkin={reward.id} />;
  const skin = TABLE_SKINS[reward.id];
  return skin ? <TablePreview skin={skin} /> : null;
}
