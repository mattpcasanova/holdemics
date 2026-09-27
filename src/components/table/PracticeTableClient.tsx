"use client";

import dynamic from "next/dynamic";

// The deck is shuffled client-side with a random seed, so skip SSR to avoid hydration mismatches.
export const PracticeTableClient = dynamic(
  () => import("./PracticeTable").then((m) => m.PracticeTable),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center text-[13px] text-text-secondary">Opening table</div>
    ),
  },
);
