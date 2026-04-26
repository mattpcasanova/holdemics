import type { Friend } from "@/lib/types";

interface FriendsListProps {
  friends: Friend[];
}

export function FriendsList({ friends }: FriendsListProps) {
  const onlineCount = friends.filter(
    (f) => f.status === "online" || f.status === "at-table"
  ).length;

  return (
    <div className="bg-surface-card border-[0.5px] border-border rounded-lg p-3.5 mb-3">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[11px] text-text-secondary tracking-widest font-medium">
          FRIENDS
        </span>
        <span className="text-[10px] text-felt">{onlineCount} online</span>
      </div>
      <div className="flex flex-col gap-2">
        {friends.map((friend) => {
          const isOnline = friend.status !== "offline";
          return (
            <div key={friend.name} className="flex items-center gap-2">
              <div className="relative w-6 h-6">
                <div className="w-6 h-6 rounded-full bg-border inline-flex items-center justify-center text-[9px] text-text-primary font-medium">
                  {friend.initials}
                </div>
                <div
                  className={`absolute bottom-0 right-0 w-[7px] h-[7px] rounded-full border-[1.5px] border-surface-card ${
                    isOnline ? "bg-felt" : "bg-text-tertiary"
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="text-[11px] text-text-primary">{friend.name}</div>
                <div className="text-[9px] text-text-secondary">
                  {friend.statusText} &middot; {friend.rating.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
