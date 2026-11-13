import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 Proxy (formerly middleware): refresh the Supabase session and apply
// auth redirects. Lesson access / paywall rules are decided elsewhere.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every page except API routes, Next internals and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
