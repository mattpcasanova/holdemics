import { NextResponse } from "next/server";
import { getFriends } from "@/lib/friends";
import { createClient, getViewer } from "@/lib/supabase/server";

type Body =
  | { action: "request"; username: string }
  | { action: "accept"; userId: string }
  | { action: "remove"; userId: string };

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json(await getFriends(viewer.id));
}

/** Send, accept, or remove a friend request. Removing also declines or unfriends. */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const supabase = await createClient();

  if (body.action === "request") {
    const username = String(body.username ?? "").trim();
    const { data } = await supabase.rpc("find_profile", { p_username: username });
    const target = (data as { id: string; username: string }[] | null)?.[0];
    if (!target) return NextResponse.json({ error: `No player named ${username}.` }, { status: 404 });
    if (target.id === viewer.id) return NextResponse.json({ error: "That's you." }, { status: 400 });
    const { error } = await supabase.from("friend_requests").insert({ from_id: viewer.id, to_id: target.id });
    if (error) {
      const dup = error.code === "23505";
      return NextResponse.json({ error: dup ? `You and ${target.username} are already connected or have a pending request.` : error.message }, { status: dup ? 409 : 500 });
    }
    return NextResponse.json({ ok: true, username: target.username });
  }

  if (body.action === "accept") {
    const { error, count } = await supabase
      .from("friend_requests")
      .update({ status: "accepted", responded_at: new Date().toISOString() }, { count: "exact" })
      .eq("from_id", body.userId)
      .eq("to_id", viewer.id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!count) return NextResponse.json({ error: "No pending request from that player." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove") {
    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .or(`and(from_id.eq.${viewer.id},to_id.eq.${body.userId}),and(from_id.eq.${body.userId},to_id.eq.${viewer.id})`);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
