import Link from "next/link";
import { LABELS, LABEL_KEYS } from "@/lib/catalog";
import { startWorkout } from "@/lib/actions";
import { recentWorkouts } from "@/lib/workouts";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="mb-1 text-2xl font-bold">Start workout</h1>
        <Link href="/analytics" className="text-sm font-semibold underline">Analytics →</Link>
      </div>
      <p className="mb-4 text-sm opacity-60">Aaj ka din kaunsa hai?</p>
      <form action={startWorkout} className="grid grid-cols-2 gap-3">
        {LABEL_KEYS.map((k) => (
          <button key={k} name="label" value={k} className="rounded-xl border border-current/20 p-5 text-lg font-semibold active:bg-current/10">
            {LABELS[k].name}
          </button>
        ))}
      </form>
      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase opacity-60">Recent</h2>
      <ul className="space-y-2">
        {recentWorkouts().map((w) => (
          <li key={w.id}>
            <Link href={`/workout/${w.id}`} className="flex justify-between rounded-lg border border-current/20 p-3">
              <span>{LABELS[w.label].name}</span>
              <span className="opacity-60">{w.date}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
