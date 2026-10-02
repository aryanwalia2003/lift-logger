"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { LABELS, LABEL_KEYS, type Label } from "@/lib/catalog";
import { logout } from "@/lib/auth-actions";
import { store } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  const recent = useLiveQuery(() => store.recentWorkouts(), []) ?? [];

  async function start(label: Label) {
    const w = await store.createWorkout(label);
    router.push(`/workout?id=${w.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="mb-1 text-2xl font-bold">Start workout</h1>
        <Link href="/analytics" className="text-sm font-semibold underline">Analytics →</Link>
      </div>
      <p className="mb-4 text-sm opacity-60">What kind of day is it?</p>
      <div className="grid grid-cols-2 gap-3">
        {LABEL_KEYS.map((k) => (
          <button key={k} type="button" onClick={() => void start(k)} className="rounded-xl border border-current/20 p-5 text-lg font-semibold active:bg-current/10">
            {LABELS[k].name}
          </button>
        ))}
      </div>
      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase opacity-60">Recent</h2>
      <ul className="space-y-2">
        {recent.map((w) => (
          <li key={w.id}>
            <Link href={`/workout?id=${w.id}`} className="flex justify-between rounded-lg border border-current/20 p-3">
              <span>{LABELS[w.label].name}</span>
              <span className="opacity-60">{w.date}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout} className="mt-8 text-center"><button className="text-xs underline opacity-50">Logout</button></form>
    </main>
  );
}
