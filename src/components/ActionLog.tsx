import type { ActionLogEntry } from "@/lib/types";

interface ActionLogProps {
  entries: ActionLogEntry[];
}

export function ActionLog({ entries }: ActionLogProps) {
  return (
    <div className="p-3 border-b-[0.5px] border-border flex-1">
      <div className="text-[10px] text-text-secondary tracking-widest font-medium mb-2">
        ACTION
      </div>
      <div className="flex flex-col gap-1.5 text-[11px] text-text-secondary leading-snug">
        {entries.map((entry, i) => {
          if (entry.type === "divider") {
            return (
              <div
                key={i}
                className="text-text-tertiary text-[10px] pt-0.5 border-t border-dashed border-border mt-0.5"
              >
                {entry.text}
              </div>
            );
          }
          if (entry.type === "highlight") {
            return (
              <div key={i} className="text-gold">
                {entry.text}
              </div>
            );
          }
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: entry.text }} />
          );
        })}
      </div>
    </div>
  );
}
