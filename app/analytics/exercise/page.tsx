"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { exerciseById } from "@/lib/catalog";
import { exerciseSessions, inRange, repBuckets, type Range } from "@/lib/analytics";
import { useRows } from "@/lib/use-rows";
import { Card, Empty, HBars, LineChart, Loading, Missing, RangeTabs, Stats, kg, shortDate } from "../ui";

export default function Page() {
  return (
    <Suspense>
      <ExercisePage />
    </Suspense>
  );
}

function ExercisePage() {
  const id = Number(useSearchParams().get("id"));
  const [range, setRange] = useState<Range>("90");
  const all = useRows();
  const ex = exerciseById(id);
  if (!ex) return <Missing what="Exercise" />;
  if (!all) return <Loading />;
  const mine = all.filter((r) => r.exerciseId === id);
  const sessionsAll = exerciseSessions(mine); // PR flag poori history se
  const ss = inRange(sessionsAll, range);
  const rows = inRange(mine, range);
  const first = ss[0], last = ss.at(-1);

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold capitalize">{ex.name}</h1>
      <RangeTabs current={range} onChange={setRange} />
      {!last ? <Card title="Nothing found"><Empty>This exercise wasn&apos;t done in this range.</Empty></Card> : (
        <>
          <Stats items={[
            ["Best e1RM", kg(Math.max(...ss.map((s) => s.e1rm)))],
            ["Heaviest", kg(Math.max(...ss.map((s) => s.topWeight)))],
            ["Sessions", String(ss.length)],
            ["Change", ss.length > 1 ? `${last.e1rm >= first.e1rm ? "▲" : "▼"} ${Math.abs((last.e1rm / first.e1rm - 1) * 100).toFixed(1)}%` : "—"],
          ]} />
          <Card title="Estimated 1RM" sub="Best set per session, Epley formula">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.e1rm }))} />
          </Card>
          <Card title="Top weight" sub="Heaviest set per session">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.topWeight }))} />
          </Card>
          <Card title="Volume per session" sub="Weight × reps">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.volume }))} />
          </Card>
          <Card title="Rep ranges" sub="Total sets">
            <HBars rows={repBuckets(rows)} />
          </Card>
          <Card title="History" sub="PR = new estimated 1RM best · ↳ = drop set, SS = superset">
            <ul className="divide-y divide-current/10">
              {[...ss].reverse().slice(0, 20).map((s) => (
                <li key={s.id}>
                  <Link href={`/workout?id=${s.id}`} className="block py-2 text-sm">
                    <span className="flex justify-between"><span>{shortDate(s.date)}{s.sets.some((r) => r.supersetId) && <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs">SS</span>}</span>{s.pr && <span className="font-semibold">🏆 PR</span>}</span>
                    <span className="text-xs opacity-60">{s.sets.map((r) => `${r.isDrop ? "↳" : ""}${r.weight}×${r.reps}`).join(" · ")}</span>
                    {s.sets.filter((r) => r.note).map((r, i) => (
                      <span key={i} className="mt-0.5 block text-xs italic opacity-60">&ldquo;{r.note}&rdquo; ({r.weight}×{r.reps})</span>
                    ))}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
