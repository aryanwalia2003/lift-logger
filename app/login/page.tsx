"use client";
import { useActionState } from "react";
import { login } from "@/lib/auth-actions";

export default function Login() {
  const [error, action, pending] = useActionState(login, undefined);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Lift Log</h1>
      <form action={action} className="flex flex-col gap-3">
        <input name="password" type="password" autoComplete="current-password" required autoFocus placeholder="Password"
          className="rounded-lg border border-current/30 bg-transparent p-3 text-lg" />
        <button disabled={pending} className="rounded-lg bg-foreground p-3 font-semibold text-background disabled:opacity-60">Enter</button>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      </form>
    </main>
  );
}
