import { createRemoteJWKSet, jwtVerify } from "jose";

export interface Identity {
  userId: string;
  username: string;
  title: string | null;
  avatar: string;
  /** Supabase anonymous sign-in; never allowed into ranked. */
  anonymous: boolean;
}

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(supabaseUrl: string) {
  let set = jwksByUrl.get(supabaseUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksByUrl.set(supabaseUrl, set);
  }
  return set;
}

/**
 * Verifies a Supabase access token against the project's public signing keys
 * and looks up the player's profile with that same token, so the display
 * name comes from the database rather than anything the client claims.
 */
export async function identify(token: string, supabaseUrl: string, publishableKey: string): Promise<Identity | null> {
  let sub: string | undefined;
  let anonymous = false;
  try {
    const { payload } = await jwtVerify(token, jwks(supabaseUrl), { issuer: `${supabaseUrl}/auth/v1` });
    sub = payload.sub;
    anonymous = payload.is_anonymous === true;
  } catch {
    return null;
  }
  if (!sub) return null;

  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${sub}&select=username,title,avatar`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { username: string; title: string | null; avatar: string }[];
  const username = rows[0]?.username;
  return username ? { userId: sub, username, title: rows[0].title ?? null, avatar: rows[0].avatar ?? "initials", anonymous } : null;
}
