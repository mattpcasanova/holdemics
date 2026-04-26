interface ChipStackProps {
  pot: number;
}

interface Denomination {
  value: number;
  fill: string;
  stroke: string;
}

const DENOMINATIONS: Denomination[] = [
  { value: 25, fill: "var(--gold)", stroke: "var(--gold-dark)" },
  { value: 5, fill: "var(--red)", stroke: "var(--red-dark)" },
  { value: 1, fill: "var(--felt)", stroke: "var(--felt-deepest)" },
];

function breakIntoDenominations(amount: number): { denom: Denomination; count: number }[] {
  const stacks: { denom: Denomination; count: number }[] = [];
  let remaining = amount;

  for (const denom of DENOMINATIONS) {
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      stacks.push({ denom, count: Math.min(count, 12) });
      remaining -= count * denom.value;
    }
  }

  return stacks;
}

export function ChipStack({ pot }: ChipStackProps) {
  const stacks = breakIntoDenominations(pot);
  if (stacks.length === 0) return null;

  const totalWidth = stacks.length * 32 + (stacks.length - 1) * 6;
  const maxChips = Math.max(...stacks.map((s) => s.count));
  const height = maxChips * 3 + 16;

  return (
    <svg
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
    >
      {stacks.map((stack, si) => {
        const cx = si * 38 + 16;
        const baseY = height - 4;

        return (
          <g key={si}>
            {/* Shadow */}
            <ellipse
              cx={cx}
              cy={baseY}
              rx={13}
              ry={3.5}
              fill="var(--felt-deepest)"
              opacity={0.5}
            />
            {/* Chips */}
            {Array.from({ length: stack.count }).map((_, ci) => {
              const y = baseY - (ci + 1) * 3;
              const isEdge = ci % 2 === 0;
              return (
                <ellipse
                  key={ci}
                  cx={cx}
                  cy={y}
                  rx={13}
                  ry={3.5}
                  fill={isEdge ? stack.denom.fill : "var(--surface-primary)"}
                  stroke={isEdge ? stack.denom.stroke : "#0A0C0E"}
                  strokeWidth={0.5}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
