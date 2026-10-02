import Link from "next/link";
import { notFound } from "next/navigation";
import { LABELS } from "@/lib/catalog";
import { logDrop, logSet, logSuperset, removeSet } from "@/lib/actions";
import { exercisesOf, getExercise, getWorkout, lastSet, latestInWorkout, orderedBodyParts, workoutSets } from "@/lib/workouts";

export const dynamic = "force-dynamic";

type Q = { bp?: string; ex?: string; ss?: string; mode?: string; pick?: string };

const chip = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm capitalize ${on ? "bg-foreground text-background" : "border-current/30"}`;
const input = "w-full min-w-0 rounded-lg border border-current/30 bg-transparent p-3 text-lg";

export default async function Workout({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Q> }) {
  const { id } = await params;
  const q = await searchParams;
  const w = await getWorkout(Number(id));
  if (!w) notFound();

  const base = `/workout/${w.id}`;
  const href = (p: Q) => {
    const sp = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);
    return `${base}?${sp}`;
  };
  const picking = !!q.pick && !!q.ex; // superset partner chun rahe hain

  // Turso network latency — independent queries ek saath
  const [{ suggested, others }, exList, exercise, logged] = await Promise.all([
    orderedBodyParts(w.label),
    q.bp ? exercisesOf(Number(q.bp)) : Promise.resolve([]),
    q.ex ? getExercise(Number(q.ex)) : Promise.resolve(undefined),
    workoutSets(w.id),
  ]);
  const partner = exercise && q.ss ? await getExercise(Number(q.ss)) : undefined;
  const doneCount = (eid: number) => logged.filter((s) => s.exerciseId === eid && !s.parentSetId).length;
  const hasSets = !!exercise && doneCount(exercise.id) > 0;
  const dropMode = q.mode === "drop" && hasSets && !partner;

  // Prefill: normal → last main set; drop → is workout ka latest set ka ~80%
  const [prev, dropFrom, prevB] = await Promise.all([
    exercise ? lastSet(exercise.id) : undefined,
    dropMode ? latestInWorkout(w.id, exercise!.id) : undefined,
    partner ? lastSet(partner.id) : undefined,
  ]);
  const fillW = dropFrom ? Math.round(dropFrom.weightKg * 0.8 * 2) / 2 : prev?.weightKg;
  const fillR = dropFrom ? dropFrom.reps : prev?.reps;

  const byEx = [...new Set(logged.map((s) => s.exerciseId))].map((eid) => ({
    name: logged.find((s) => s.exerciseId === eid)!.exercise,
    sets: logged.filter((s) => s.exerciseId === eid),
  }));
  const partnerOf = (s: (typeof logged)[number]) =>
    s.supersetId ? logged.find((x) => x.supersetId === s.supersetId && x.exerciseId !== s.exerciseId)?.exercise : undefined;

  const mode = (label: string, to: string, on: boolean) => (
    <Link href={to} className={`flex-1 rounded-md py-1.5 text-center text-sm ${on ? "bg-foreground text-background" : "opacity-70"}`}>{label}</Link>
  );

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-72">
      <Link href="/" className="text-sm opacity-60">← Home</Link>
      <h1 className="text-2xl font-bold">{LABELS[w.label].name} <span className="text-sm font-normal opacity-60">{w.date}</span></h1>

      {picking && (
        <div className="mt-3 rounded-lg border border-foreground p-3 text-sm">
          <span className="capitalize">{exercise?.name}</span> ke saath superset — partner exercise chuno
          <Link href={href({ bp: q.bp, ex: q.ex })} className="ml-2 underline">cancel</Link>
        </div>
      )}

      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase opacity-60">Body part</h2>
      <div className="flex flex-wrap gap-2">
        {suggested.map((p) => <Link key={p.id} href={picking ? href({ bp: String(p.id), ex: q.ex, pick: "1" }) : href({ bp: String(p.id) })} className={chip(String(p.id) === q.bp)}>{p.name}</Link>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 opacity-60">
        {others.map((p) => <Link key={p.id} href={picking ? href({ bp: String(p.id), ex: q.ex, pick: "1" }) : href({ bp: String(p.id) })} className={chip(String(p.id) === q.bp)}>{p.name}</Link>)}
      </div>

      {exList.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-sm font-semibold uppercase opacity-60">{picking ? "Partner exercise" : "Exercise"}</h2>
          <ul className="space-y-2">
            {exList.filter((e) => !(picking && String(e.id) === q.ex)).map((e, i, arr) => (
              <li key={e.id}>
                {/* Shoulders me sub-part ka heading */}
                {e.part !== arr[i - 1]?.part && arr.some((x) => x.part !== e.part) && (
                  <div className="mb-1 mt-3 text-xs uppercase opacity-60">{e.part}</div>
                )}
                <Link href={picking ? href({ bp: q.bp, ex: q.ex, ss: String(e.id) }) : href({ bp: q.bp, ex: String(e.id) })}
                  className={`flex justify-between rounded-lg border p-3 capitalize ${[q.ex, q.ss].includes(String(e.id)) ? "border-foreground" : "border-current/20"}`}>
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
                  <span className={s.parentSetId ? "pl-4 opacity-80" : ""}>
                    {s.parentSetId ? "↳ drop" : `#${s.setNo}`} · {s.weightKg} kg × {s.reps}
                    {partnerOf(s) && <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs capitalize">SS ⇄ {partnerOf(s)}</span>}
                  </span>
                  <input type="hidden" name="setId" value={s.id} />
                  <input type="hidden" name="workoutId" value={w.id} />
                  <button className="px-2 opacity-50" aria-label="delete set">✕</button>
                </form>
              ))}
            </div>
          ))}
        </>
      )}

      {exercise && !picking && (
        <div className="fixed inset-x-0 bottom-0 border-t border-current/20 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            <div className="mb-2 flex gap-1 rounded-lg border border-current/15 p-1">
              {mode("Set", href({ bp: q.bp, ex: q.ex }), !dropMode && !partner)}
              {hasSets && mode("Drop", href({ bp: q.bp, ex: q.ex, mode: "drop" }), dropMode)}
              {mode("Superset", href({ bp: q.bp, ex: q.ex, pick: "1" }), !!partner)}
            </div>

            {partner ? (
              // Superset round: dono exercises ek form me
              <form key={`s${partner.id}-${logged.at(-1)?.id ?? 0}`} action={logSuperset}>
                <input type="hidden" name="workoutId" value={w.id} />
                {([["a", exercise, prev], ["b", partner, prevB]] as const).map(([k, e, p]) => (
                  <div key={k} className="mb-2">
                    <div className="mb-1 truncate text-sm capitalize">{e.name} {p && <span className="opacity-60">· last: {p.weightKg} × {p.reps}</span>}</div>
                    <input type="hidden" name={`exercise_${k}`} value={e.id} />
                    <div className="flex gap-2">
                      <input name={`weight_${k}`} type="number" inputMode="decimal" step="0.5" min="0" required defaultValue={p?.weightKg} placeholder="kg" className={input} />
                      <input name={`reps_${k}`} type="number" inputMode="numeric" min="1" required defaultValue={p?.reps} placeholder="reps" className={input} />
                    </div>
                  </div>
                ))}
                <button className="w-full rounded-lg bg-foreground p-3 font-semibold text-background">Log round</button>
              </form>
            ) : (
              <form key={`${dropMode ? "d" : "n"}${exercise.id}-${logged.at(-1)?.id ?? 0}`} action={dropMode ? logDrop : logSet}>
                <div className="mb-2 text-sm capitalize">{exercise.name} {dropMode ? <span className="opacity-60">· drop (≈80% of last)</span> : prev && <span className="opacity-60">· last: {prev.weightKg} × {prev.reps}</span>}</div>
                <input type="hidden" name="workoutId" value={w.id} />
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <div className="flex gap-2">
                  <input name="weight" type="number" inputMode="decimal" step="0.5" min="0" required defaultValue={fillW} placeholder="kg" className={input} />
                  <input name="reps" type="number" inputMode="numeric" min="1" required defaultValue={fillR} placeholder="reps" className={input} />
                  <button className="shrink-0 rounded-lg bg-foreground px-5 font-semibold text-background">{dropMode ? "Drop" : "Log"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
