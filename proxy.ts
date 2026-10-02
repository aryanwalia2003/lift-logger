import { NextRequest, NextResponse } from "next/server";
import { authToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    // Local dev open; production me password set na ho to sab band
    return process.env.NODE_ENV === "production" ? new NextResponse("APP_PASSWORD set nahi hai", { status: 503 }) : NextResponse.next();
  }
  if (req.nextUrl.pathname === "/login" || req.cookies.get("auth")?.value === (await authToken())) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

// Manifest + icons bina cookie ke fetch hote hain, unhe gate nahi karna
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|apple-icon).*)"],
};
