import Link from "next/link";
import { notFound } from "next/navigation";
import { LABELS } from "@/lib/catalog";
import { logSet, removeSet } from "@/lib/actions";
import { exercisesOf, getExercise, getWorkout, lastSet, orderedBodyParts, workoutSets } from "@/lib/workouts";

export const dynamic = "force-dynamic";

const chip = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm capitalize ${on ? "bg-foreground text-background" : "border-current/30"}`;

export default async function Workout({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bp?: string; ex?: string }>;
}) {
  const { id } = await params;
  const { bp, ex } = await searchParams;
  const w = getWorkout(Number(id));
  if (!w) notFound();

  const base = `/workout/${w.id}`;
  const { suggested, others } = orderedBodyParts(w.label);
  const exList = bp ? exercisesOf(Number(bp)) : [];
  const exercise = ex ? getExercise(Number(ex)) : undefined;
  const prev = exercise && lastSet(exercise.id);
  const logged = workoutSets(w.id);
  const doneCount = (eid: number) => logged.filter((s) => s.exerciseId === eid).length;

  // Exercise ke hisaab se group
  const byEx = [...new Set(logged.map((s) => s.exerciseId))].map((eid) => ({
    name: logged.find((s) => s.exerciseId === eid)!.exercise,
    sets: logged.filter((s) => s.exerciseId === eid),
  }));

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-48">
      <Link href="/" className="text-sm opacity-60">← Home</Link>
      <h1 className="text-2xl font-bold">{LABELS[w.label].name} <span className="text-sm font-normal opacity-60">{w.date}</span></h1>

      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase opacity-60">Body part</h2>
      <div className="flex flex-wrap gap-2">
        {suggested.map((p) => <Link key={p.id} href={`${base}?bp=${p.id}`} className={chip(String(p.id) === bp)}>{p.name}</Link>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 opacity-60">
        {others.map((p) => <Link key={p.id} href={`${base}?bp=${p.id}`} className={chip(String(p.id) === bp)}>{p.name}</Link>)}
      </div>

      {exList.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-sm font-semibold uppercase opacity-60">Exercise</h2>
          <ul className="space-y-2">
            {exList.map((e, i) => (
              <li key={e.id}>
                {/* Shoulders me sub-part ka heading */}
                {e.part !== exList[i - 1]?.part && exList.some((x) => x.part !== e.part) && (
                  <div className="mb-1 mt-3 text-xs uppercase opacity-60">{e.part}</div>
                )}
                <Link href={`${base}?bp=${bp}&ex=${e.id}`} className={`flex justify-between rounded-lg border p-3 capitalize ${String(e.id) === ex ? "border-foreground" : "border-current/20"}`}>
                  {e.name}
                  {doneCount(e.id) > 0 && <span className="opacity-60">{doneCount(e.id)} sets</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {byEx.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold uppercase opacity-60">Aaj ka log</h2>
          {byEx.map((g) => (
            <div key={g.name} className="mb-3">
              <div className="font-medium capitalize">{g.name}</div>
              {g.sets.map((s) => (
                <form key={s.id} action={removeSet} className="flex items-center justify-between py-1 text-sm">
                  <span>#{s.setNo} · {s.weightKg} kg × {s.reps}</span>
                  <input type="hidden" name="setId" value={s.id} />
                  <input type="hidden" name="workoutId" value={w.id} />
                  <button className="px-2 opacity-50" aria-label="delete set">✕</button>
                </form>
              ))}
            </div>
          ))}
        </>
      )}

      {exercise && (
        // key = last set → log ke baad form naye prefill ke saath remount
        <form key={prev?.id ?? 0} action={logSet} className="fixed inset-x-0 bottom-0 border-t border-current/20 bg-background p-4">
          <div className="mx-auto max-w-md">
            <div className="mb-2 text-sm capitalize">{exercise.name} {prev && <span className="opacity-60">· last: {prev.weightKg} × {prev.reps}</span>}</div>
            <input type="hidden" name="workoutId" value={w.id} />
            <input type="hidden" name="exerciseId" value={exercise.id} />
            <div className="flex gap-2">
              <input name="weight" type="number" inputMode="decimal" step="0.5" min="0" required defaultValue={prev?.weightKg} placeholder="kg" className="w-full rounded-lg border border-current/30 bg-transparent p-3 text-lg" />
              <input name="reps" type="number" inputMode="numeric" min="1" required defaultValue={prev?.reps} placeholder="reps" className="w-full rounded-lg border border-current/30 bg-transparent p-3 text-lg" />
              <button className="rounded-lg bg-foreground px-5 font-semibold text-background">Log</button>
            </div>
          </div>
        </form>
      )}
    </main>
  );
}
