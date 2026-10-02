"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LABELS, PART_COLOR, type Label } from "@/lib/catalog";
import { byExercise, byLabel, byPart, inRange, sessions, type Range } from "@/lib/analytics";
import { useRows } from "@/lib/use-rows";
import { Card, Empty, HBars, LineChart, Loading, Missing, RangeTabs, Stats, kg, shortDate, weekday } from "../ui";

export default function Page() {
  return (
    <Suspense>
      <LabelPage />
    </Suspense>
  );
}

function LabelPage() {
  const key = useSearchParams().get("key") ?? "";
  const [range, setRange] = useState<Range>("90");
  const all = useRows();
  if (!(key in LABELS)) return <Missing what="Label" />;
  if (!all) return <Loading />;
  const label = key as Label;
  const rows = inRange(all.filter((r) => r.label === label), range);
  const ss = sessions(rows);
  const l = byLabel(rows)[0];

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold">{LABELS[label].name}</h1>
      <RangeTabs current={range} onChange={setRange} />
      {!l ? <Card title="Nothing found"><Empty>No {LABELS[label].name} sessions in this range.</Empty></Card> : (
        <>
          <Stats items={[
            ["Sessions", String(l.count)],
            ["Frequency", l.everyDays ? `every ${l.everyDays.toFixed(1)} d` : "—"],
            ["Avg sets", String(Math.round(l.avgSets))],
            ["Avg volume", kg(l.avgVolume)],
          ]} />
          <Card title="Volume per session" sub="Weight × reps, kg">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.volume }))} />
          </Card>
          <Card title="Body parts trained" sub="Total sets per body part in this label">
            <HBars rows={byPart(rows).map((p) => ({ label: p.name, value: p.sets, href: `/analytics/part?id=${p.id}`, color: PART_COLOR[p.name] }))} />
          </Card>
          <Card title="Top exercises" sub="By number of sets">
            <HBars rows={byExercise(rows).slice(0, 8).map((e) => ({ label: e.name, value: e.sets, href: `/analytics/exercise?id=${e.id}` }))} />
          </Card>
          <Card title="Sessions">
            <ul className="divide-y divide-current/10">
              {[...ss].reverse().slice(0, 15).map((s) => (
                <li key={s.id}>
                  <Link href={`/workout?id=${s.id}`} className="flex justify-between py-2 text-sm">
                    <span>{weekday(s.date)}, {shortDate(s.date)}</span>
                    <span className="opacity-60">{s.sets} sets · {kg(s.volume)}</span>
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
