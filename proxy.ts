import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Game-specific domains land on the homepage pre-filtered to that game.
// Add these as project domains in the Vercel dashboard.
const GAME_BY_HOST: Record<string, "tcg" | "vgc"> = {
  "pkmgranadatcg.vercel.app": "tcg",
  "pkmgranadavgc.vercel.app": "vgc",
};

// Next.js 16 renamed Middleware to Proxy (same behavior, Node.js runtime).
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const game = GAME_BY_HOST[host];
  const { pathname, searchParams } = request.nextUrl;

  if (game && pathname === "/" && !searchParams.has("game")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("game", game);
    return await updateSession(request, () =>
      NextResponse.rewrite(url, { request }),
    );
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
