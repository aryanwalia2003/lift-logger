"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LABELS, PART_COLOR, partById } from "@/lib/catalog";
import { byExercise, countBy, groupBy, inRange, summary, weekly, weeksIn, type Range } from "@/lib/analytics";
import { useRows } from "@/lib/use-rows";
import { Bars, Card, Empty, HBars, Legend, Loading, Missing, RangeTabs, Stats, shortDate } from "../ui";

export default function Page() {
  return (
    <Suspense>
      <PartPage />
    </Suspense>
  );
}

function PartPage() {
  const id = Number(useSearchParams().get("id"));
  const [range, setRange] = useState<Range>("90");
  const all = useRows();
  const name = partById(id)?.name;
  if (!name) return <Missing what="Body part" />;
  if (!all) return <Loading />;
  const mine = all.filter((r) => r.topId === id || r.partId === id);
  const rows = inRange(mine, range);
  const s = summary(rows, range);
  const subs = [...new Set(rows.map((r) => r.part))]; // shoulders → front/side delt
  const wk = weekly(rows, Math.min(52, weeksIn(mine, range)), (r) => r.part);
  const labels = countBy([...groupBy(rows, (r) => r.workoutId)].map(([, rs]) => rs[0]), (r) => r.label);
  const exs = byExercise(rows);

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold capitalize">{name}</h1>
      <RangeTabs current={range} onChange={setRange} />
      {rows.length === 0 ? <Card title="Nothing found"><Empty>{name} wasn&apos;t trained in this range.</Empty></Card> : (
        <>
          <Stats items={[
            ["Sets", String(s.sets)],
            ["Sets / week", (s.sets / weeksIn(mine, range)).toFixed(1)],
            ["Sessions", String(s.workouts)],
            ["Last trained", s.last ? shortDate(s.last) : "—"],
          ]} />
          <Card title="Weekly sets" sub="Sets per week">
            <Bars data={wk.map((w) => ({ x: shortDate(w.week), tip: `Week of ${shortDate(w.week)}`, segs: subs.map((k) => ({ key: k, v: w.parts[k] ?? 0 })) }))} unit=" sets" />
            {subs.length > 1 && <Legend keys={subs} />}
          </Card>
          <Card title="Trained on which label" sub="Sessions">
            <HBars rows={Object.entries(labels).sort((a, b) => b[1] - a[1]).map(([l, n]) => ({ label: LABELS[l as keyof typeof LABELS].name, value: n, href: `/analytics/label?key=${l}`, color: PART_COLOR[name] }))} />
          </Card>
          <Card title="Exercises" sub="Change in estimated 1RM over this range">
            <ul className="divide-y divide-current/10">
              {exs.map((e) => (
                <li key={e.id}>
                  <Link href={`/analytics/exercise?id=${e.id}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0"><span className="block truncate text-sm capitalize">{e.name}</span><span className="text-xs opacity-60">{e.sets} sets · {e.sessions} sessions</span></span>
                    <span className="shrink-0 text-right text-sm tabular-nums">{Math.round(e.bestE1rm)} kg
                      {e.change !== null && <span className="block text-xs opacity-60">{e.change >= 0 ? "▲" : "▼"} {Math.abs(e.change).toFixed(1)}%</span>}
                    </span>
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
