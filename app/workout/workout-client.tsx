"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { LABELS, exerciseById } from "@/lib/catalog";
import { store } from "@/lib/client";
import { exercisesOf, orderedBodyParts } from "@/lib/store";

// Selection sirf component state — URL me sirf workout id (navigation offline server pe depend na kare)
type Sel = { bp?: number; ex?: number; ss?: number; mode?: "drop"; pick?: boolean };

const chip = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm capitalize ${on ? "bg-foreground text-background" : "border-current/30"}`;
const input = "w-full min-w-0 rounded-lg border border-current/30 bg-transparent p-3 text-lg";

export function WorkoutClient() {
  const id = useSearchParams().get("id") ?? "";
  const found = useLiveQuery(async () => ({ w: await store.getWorkout(id) }), [id]);
  const logged = useLiveQuery(() => store.workoutSets(id), [id]) ?? [];
  const [sel, setSel] = useState<Sel>({});
  const [err, setErr] = useState("");

  const exercise = sel.ex ? exerciseById(sel.ex) : undefined;
  const partner = exercise && sel.ss ? exerciseById(sel.ss) : undefined;
  // Prefill queries {x} me wrap — "load ho gaya" aur "koi set nahi" me farak; form load ke baad hi dikhta hai
  // (defaults final → typing ke beech remount nahi)
  const prevQ = useLiveQuery(async () => ({ x: sel.ex ? await store.lastSet(sel.ex) : undefined }), [sel.ex]);
  const prevBQ = useLiveQuery(async () => ({ x: sel.ss ? await store.lastSet(sel.ss) : undefined }), [sel.ss]);
  const dropQ = useLiveQuery(async () => ({ x: sel.mode === "drop" && sel.ex ? await store.latestInWorkout(id, sel.ex) : undefined }), [id, sel.ex, sel.mode]);
  const prev = prevQ?.x, prevB = prevBQ?.x, dropFrom = dropQ?.x;
  const prefillReady = !!prevQ && !!prevBQ && !!dropQ;

  if (!found) return <main className="mx-auto w-full max-w-md p-4 text-sm opacity-60">Loading…</main>;
  const w = found.w;
  if (!w) {
    return (
      <main className="mx-auto w-full max-w-md p-4">
        <Link href="/" className="text-sm opacity-60">← Home</Link>
        <p className="mt-4">Workout not found on this device.</p>
      </main>
    );
  }

  const picking = !!sel.pick && !!sel.ex; // superset partner chun rahe hain
  const { suggested, others } = orderedBodyParts(w.label);
  const exList = sel.bp ? exercisesOf(sel.bp) : [];
  const doneCount = (eid: number) => logged.filter((s) => s.exerciseId === eid && !s.parentSetId).length;
  const hasSets = !!exercise && doneCount(exercise.id) > 0;
  const dropMode = sel.mode === "drop" && hasSets && !partner;
  // Prefill: normal → last main set; drop → is workout ka latest set ka ~80%
  const fillW = dropMode && dropFrom ? Math.round(dropFrom.weightKg * 0.8 * 2) / 2 : prev?.weightKg;
  const fillR = dropMode && dropFrom ? dropFrom.reps : prev?.reps;

  const byEx = [...new Set(logged.map((s) => s.exerciseId))].map((eid) => ({
    name: logged.find((s) => s.exerciseId === eid)!.exercise,
    sets: logged.filter((s) => s.exerciseId === eid),
  }));
  const partnerOf = (s: (typeof logged)[number]) =>
    s.supersetId ? logged.find((x) => x.supersetId === s.supersetId && x.exerciseId !== s.exerciseId)?.exercise : undefined;

  const run = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    }
  };
  const num = (fd: FormData, k: string) => Number(fd.get(k));
  const pickBp = (bp: number) => setSel(picking ? { bp, ex: sel.ex, pick: true } : { bp });
  const tab = (label: string, to: Sel, on: boolean) => (
    <button type="button" onClick={() => setSel(to)} className={`flex-1 rounded-md py-1.5 text-center text-sm ${on ? "bg-foreground text-background" : "opacity-70"}`}>{label}</button>
  );
  const lastKey = logged.at(-1)?.id ?? 0;

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-72">
      <Link href="/" className="text-sm opacity-60">← Home</Link>
      <h1 className="text-2xl font-bold">{LABELS[w.label].name} <span className="text-sm font-normal opacity-60">{w.date}</span></h1>

      {picking && (
        <div className="mt-3 rounded-lg border border-foreground p-3 text-sm">
          <span className="capitalize">{exercise?.name}</span> — pick a superset partner
          <button type="button" onClick={() => setSel({ bp: sel.bp, ex: sel.ex })} className="ml-2 underline">cancel</button>
        </div>
      )}

      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase opacity-60">Body part</h2>
      <div className="flex flex-wrap gap-2">
        {suggested.map((p) => <button type="button" key={p.id} onClick={() => pickBp(p.id)} className={chip(p.id === sel.bp)}>{p.name}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 opacity-60">
        {others.map((p) => <button type="button" key={p.id} onClick={() => pickBp(p.id)} className={chip(p.id === sel.bp)}>{p.name}</button>)}
      </div>

      {exList.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-sm font-semibold uppercase opacity-60">{picking ? "Partner exercise" : "Exercise"}</h2>
          <ul className="space-y-2">
            {exList.filter((e) => !(picking && e.id === sel.ex)).map((e, i, arr) => (
              <li key={e.id}>
                {/* Shoulders me sub-part ka heading */}
                {e.part !== arr[i - 1]?.part && arr.some((x) => x.part !== e.part) && (
                  <div className="mb-1 mt-3 text-xs uppercase opacity-60">{e.part}</div>
                )}
                <button type="button" onClick={() => setSel(picking ? { bp: sel.bp, ex: sel.ex, ss: e.id } : { bp: sel.bp, ex: e.id })}
                  className={`flex w-full justify-between rounded-lg border p-3 text-left ${e.id === sel.ex || e.id === sel.ss ? "border-foreground" : "border-current/20"}`}>
                  <span className="capitalize">{e.name}</span>
                  {doneCount(e.id) > 0 && <span className="opacity-60">{doneCount(e.id)} {doneCount(e.id) === 1 ? "set" : "sets"}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {byEx.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-semibold uppercase opacity-60">Today&apos;s log</h2>
          {byEx.map((g) => (
            <div key={g.name} className="mb-3">
              <div className="font-medium capitalize">{g.name}</div>
              {g.sets.map((s) => (
                <div key={s.id} className="flex items-start justify-between text-sm">
                  {/* Tap = edit (weight/reps/note), closed by default */}
                  <details key={`${s.weightKg}-${s.reps}-${s.note}`} className="min-w-0 flex-1">
                    <summary className="cursor-pointer list-none py-1">
                      <span className={s.parentSetId ? "pl-4 opacity-80" : ""}>
                        {s.parentSetId ? "↳ drop" : `#${s.setNo}`} · {s.weightKg} kg × {s.reps}
                        {partnerOf(s) && <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs capitalize">SS ⇄ {partnerOf(s)}</span>}
                        <span className="ml-2 text-xs opacity-30" aria-label="edit set">✎</span>
                      </span>
                      {s.note && <span className="block pl-4 text-xs italic opacity-60">&ldquo;{s.note}&rdquo;</span>}
                    </summary>
                    <form action={(fd) => run(() => store.updateSet(s.id, num(fd, "weight"), num(fd, "reps"), String(fd.get("note") ?? "")))}
                      className="my-1 space-y-2 rounded-lg border border-current/15 p-3">
                      <div className="flex gap-2">
                        <input name="weight" type="number" inputMode="decimal" step="0.5" min="0" required defaultValue={s.weightKg} aria-label="Weight (kg)" className={input} />
                        <input name="reps" type="number" inputMode="numeric" min="1" required defaultValue={s.reps} aria-label="Reps" className={input} />
                      </div>
                      <input name="note" maxLength={500} defaultValue={s.note ?? ""} placeholder="Note (optional)" aria-label="Set note" className={input} />
                      <button className="w-full rounded-lg bg-foreground p-2 font-semibold text-background">Save</button>
                    </form>
                  </details>
                  <button type="button" onClick={() => run(() => store.deleteSet(s.id))} className="px-2 py-1 opacity-50" aria-label="delete set">✕</button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Workout notes: sabse neeche, collapsed — logging ke raaste me nahi */}
      <details key={w.notes ?? ""} className="mt-8 text-sm">
        <summary className="cursor-pointer list-none opacity-60">
          Workout notes{w.notes ? ` · ${w.notes.slice(0, 40)}${w.notes.length > 40 ? "…" : ""}` : ""}
        </summary>
        <form action={(fd) => run(() => store.setWorkoutNotes(w.id, String(fd.get("notes") ?? "")))} className="mt-2 space-y-2">
          <textarea name="notes" rows={3} maxLength={500} defaultValue={w.notes ?? ""} placeholder="How did the session go?" aria-label="Workout notes" className={input} />
          <button className="w-full rounded-lg bg-foreground p-2 font-semibold text-background">Save notes</button>
        </form>
      </details>

      {exercise && !picking && prefillReady && (
        <div className="fixed inset-x-0 bottom-0 border-t border-current/20 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-md">
            {err && <p role="alert" className="mb-2 text-sm text-red-500">{err}</p>}
            <div className="mb-2 flex gap-1 rounded-lg border border-current/15 p-1">
              {tab("Set", { bp: sel.bp, ex: sel.ex }, !dropMode && !partner)}
              {hasSets && tab("Drop", { bp: sel.bp, ex: sel.ex, mode: "drop" }, dropMode)}
              {tab("Superset", { bp: sel.bp, ex: sel.ex, pick: true }, !!partner)}
            </div>

            {partner ? (
              // Superset round: dono exercises ek form me
              <form key={`s${partner.id}-${lastKey}`}
                action={(fd) => run(() => store.addRound(w.id, [
                  { exerciseId: exercise.id, weightKg: num(fd, "weight_a"), reps: num(fd, "reps_a") },
                  { exerciseId: partner.id, weightKg: num(fd, "weight_b"), reps: num(fd, "reps_b") },
                ]))}>
                {([["a", exercise, prev], ["b", partner, prevB]] as const).map(([k, e, p]) => (
                  <div key={k} className="mb-2">
                    <div className="mb-1 truncate text-sm capitalize">{e.name} {p && <span className="opacity-60">· last: {p.weightKg} × {p.reps}</span>}</div>
                    <div className="flex gap-2">
                      <input name={`weight_${k}`} type="number" inputMode="decimal" step="0.5" min="0" required defaultValue={p?.weightKg} placeholder="kg" className={input} />
                      <input name={`reps_${k}`} type="number" inputMode="numeric" min="1" required defaultValue={p?.reps} placeholder="reps" className={input} />
                    </div>
                  </div>
                ))}
                <button className="w-full rounded-lg bg-foreground p-3 font-semibold text-background">Log round</button>
              </form>
            ) : (
              <form key={`${dropMode ? "d" : "n"}${exercise.id}-${lastKey}`}
                action={(fd) => run(() => store.addSet(w.id, exercise.id, num(fd, "weight"), num(fd, "reps"), { drop: dropMode }))}>
                <div className="mb-2 text-sm capitalize">{exercise.name} {dropMode ? <span className="opacity-60">· drop (≈80% of last)</span> : prev && <span className="opacity-60">· last: {prev.weightKg} × {prev.reps}</span>}</div>
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
