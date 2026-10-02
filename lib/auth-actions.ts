"use server";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authToken } from "./auth";

export async function login(_: string | undefined, fd: FormData) {
  const given = Buffer.from(String(fd.get("password") ?? "").padEnd(256).slice(0, 256));
  const real = Buffer.from((process.env.APP_PASSWORD ?? "").padEnd(256).slice(0, 256));
  if (!process.env.APP_PASSWORD || !timingSafeEqual(given, real)) return "Wrong password";
  (await cookies()).set("auth", await authToken(), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/",
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete("auth");
  redirect("/login");
}
