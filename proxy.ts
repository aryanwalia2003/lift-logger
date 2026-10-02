import { NextRequest, NextResponse } from "next/server";
import { authToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    // Local dev open; production me password set na ho to sab band
    return process.env.NODE_ENV === "production" ? new NextResponse("APP_PASSWORD is not set", { status: 503 }) : NextResponse.next();
  }
  const path = req.nextUrl.pathname;
  if (path === "/login" || req.cookies.get("auth")?.value === (await authToken())) return NextResponse.next();
  // API (sync) ko redirect nahi, 401 — client "Sign in to sync" dikhata hai
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

// Manifest, icons, service worker bina cookie ke fetch hote hain (redirect pe SW register fail), unhe gate nahi karna
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|apple-icon|sw.js).*)"],
};
