import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation landing. Handles both link styles: the default PKCE link
 * (`?code=`) and the token-hash template (`?token_hash=&type=`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const done = request.nextUrl.clone();
  done.search = "";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  if (ok) {
    done.pathname = "/";
    done.searchParams.set("welcome", "1");
  } else if (code) {
    // Supabase verified the email before redirecting here; the session exchange only fails when the
    // link is opened in a different browser than the one that signed up. Signing in works.
    done.pathname = "/login";
    done.searchParams.set("confirmed", "1");
  } else {
    done.pathname = "/login";
    done.searchParams.set("error", "link");
  }
  return NextResponse.redirect(done);
}
