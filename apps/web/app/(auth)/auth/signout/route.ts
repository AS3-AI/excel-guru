import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only, so a prefetch or a stray <img src> can't sign anyone out.
// Use: <form action="/auth/signout" method="post"><button>Log out</button></form>
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  // 303 turns the POST into a GET of the landing page.
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
