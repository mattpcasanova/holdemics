"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Felt } from "@/components/Felt";
import { CardFace } from "@/components/CardFace";
import { BetSizer } from "@/components/BetSizer";
import { ActionButtons } from "@/components/ActionButtons";
import { PlacementPanel } from "@/components/PlacementPanel";
import { ActionLog } from "@/components/ActionLog";
import type { Player, Card, PlacementEntry, ActionLogEntry } from "@/lib/types";

const MOCK_PLAYERS: Player[] = [
  { id: "1", name: "sam", initials: "SK", hp: 92, maxHp: 100, bbs: 23, position: "SB", status: "active", isHero: false, inPot: 12 },
  { id: "2", name: "bella", initials: "BL", hp: 24, maxHp: 100, bbs: 6, position: "BB", status: "folded", isHero: false },
  { id: "3", name: "vivi", initials: "VV", hp: 67, maxHp: 100, bbs: 17, position: "UTG", status: "folded", isHero: false },
  { id: "4", name: "bigD", initials: "BD", hp: 114, maxHp: 100, bbs: 28, position: "CO", status: "acting", isHero: false, inPot: 28 },
  { id: "5", name: "danilo", initials: "DN", hp: 80, maxHp: 100, bbs: 20, position: "D", status: "folded", isHero: false },
  { id: "6", name: "mattcasanova", initials: "MC", hp: 119, maxHp: 100, bbs: 30, position: "MP", status: "active", isHero: true, inPot: 28 },
];

const MOCK_COMMUNITY_CARDS: Card[] = [
  { rank: "A", suit: "hearts" },
  { rank: "K", suit: "spades" },
  { rank: "7", suit: "diamonds" },
];

const MOCK_HERO_CARDS: [Card, Card] = [
  { rank: "Q", suit: "clubs" },
  { rank: "J", suit: "clubs" },
];

const MOCK_PLACEMENTS: PlacementEntry[] = [
  { rank: 1, name: "mattcasanova", hp: 119, bbs: 30, isHero: true },
  { rank: 2, name: "bigD", hp: 114, bbs: 28, isHero: false },
  { rank: 3, name: "sam", hp: 92, bbs: 23, isHero: false },
  { rank: 4, name: "danilo", hp: 80, bbs: 20, isHero: false },
  { rank: 5, name: "vivi", hp: 67, bbs: 17, isHero: false },
  { rank: 6, name: "bella", hp: 24, bbs: 6, isHero: false },
];

const MOCK_ACTION_LOG: ActionLogEntry[] = [
  { text: "\u2014 hand 847 \u2014", type: "divider" },
  { text: '<span class="text-text-primary">bigD</span> raises to <span class="text-gold">12</span>', type: "action" },
  { text: '<span class="text-gold">you</span> 3-bet to <span class="text-gold">28</span>', type: "action" },
  { text: '<span class="text-text-primary">bella</span> folds', type: "action" },
  { text: '<span class="text-text-primary">sam</span> calls <span class="text-gold">28</span>', type: "action" },
  { text: '<span class="text-text-primary">bigD</span> calls <span class="text-gold">28</span>', type: "action" },
  { text: "\u2014 flop \u2014", type: "divider" },
  { text: "your turn", type: "highlight" },
];

export default function TablePage() {
  const [betValue, setBetValue] = useState(40);

  return (
    <div className="max-w-[1080px] mx-auto w-full">
      <div className="bg-surface-primary rounded-xl border-[0.5px] border-border overflow-hidden">
        <Header
          variant="table"
          handNumber={847}
          orbit={4}
          blinds={{ sb: 2, bb: 4 }}
          nextBlinds={{ sb: 3, bb: 6 }}
          handsUntilBlindUp={5}
          pot={68}
        />

        <div className="grid grid-cols-[1fr_200px]">
          {/* Table area */}
          <div className="bg-surface-primary p-4 min-h-[560px] relative">
            <Felt
              players={MOCK_PLAYERS}
              pot={68}
              communityCards={MOCK_COMMUNITY_CARDS}
              street="flop"
            />

            {/* Hero controls */}
            <div className="flex items-center gap-2 mt-3.5 px-1">
              {/* Hero hole cards */}
              <div className="flex gap-0.5">
                <CardFace card={MOCK_HERO_CARDS[0]} size="sm" />
                <CardFace card={MOCK_HERO_CARDS[1]} size="sm" />
              </div>

              <BetSizer
                value={betValue}
                min={28}
                max={119}
                pot={68}
                onValueChange={setBetValue}
              />
            </div>

            <div className="mt-2 px-1">
              <ActionButtons
                canCheck={true}
                betAmount={betValue}
                onFold={() => {}}
                onCheckCall={() => {}}
                onBetRaise={() => {}}
              />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="bg-surface-deep border-l-[0.5px] border-border flex flex-col">
            <PlacementPanel entries={MOCK_PLACEMENTS} averageHp={80} />
            <ActionLog entries={MOCK_ACTION_LOG} />
            <div className="p-2.5">
              <div className="flex gap-1.5">
                <button className="flex-1 py-1.5 bg-transparent border-[0.5px] border-border rounded text-text-secondary text-[10px] hover:text-text-primary transition-colors">
                  Chat
                </button>
                <button className="flex-1 py-1.5 bg-transparent border-[0.5px] border-border rounded text-text-secondary text-[10px] hover:text-text-primary transition-colors">
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
