import Link from "next/link";
import { notFound } from "next/navigation";
import { LABELS, PART_COLOR, type Label } from "@/lib/catalog";
import { byExercise, byLabel, byPart, inRange, loadRows, parseRange, sessions } from "@/lib/analytics";
import { Card, Empty, HBars, LineChart, RangeTabs, Stats, kg, shortDate, weekday } from "../../ui";

export const dynamic = "force-dynamic";

export default async function LabelPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ range?: string }> }) {
  const { key } = await params;
  if (!(key in LABELS)) notFound();
  const label = key as Label;
  const range = parseRange((await searchParams).range);
  const rows = inRange((await loadRows()).filter((r) => r.label === label), range);
  const ss = sessions(rows);
  const l = byLabel(rows)[0];
  const base = `/analytics/label/${label}`;

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold">{LABELS[label].name}</h1>
      <RangeTabs base={base} current={range} />
      {!l ? <Card title="Kuch nahi mila"><Empty>Is range me {LABELS[label].name} nahi hua.</Empty></Card> : (
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
          <Card title="Body parts trained" sub="Total sets — label ke andar bhi alag parts">
            <HBars rows={byPart(rows).map((p) => ({ label: p.name, value: p.sets, href: `/analytics/part/${p.id}`, color: PART_COLOR[p.name] }))} />
          </Card>
          <Card title="Top exercises" sub="Sets ke hisaab se">
            <HBars rows={byExercise(rows).slice(0, 8).map((e) => ({ label: e.name, value: e.sets, href: `/analytics/exercise/${e.id}` }))} />
          </Card>
          <Card title="Sessions">
            <ul className="divide-y divide-current/10">
              {[...ss].reverse().slice(0, 15).map((s) => (
                <li key={s.id}>
                  <Link href={`/workout/${s.id}`} className="flex justify-between py-2 text-sm">
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
