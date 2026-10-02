import Link from "next/link";
import { notFound } from "next/navigation";
import { LABELS, PART_COLOR } from "@/lib/catalog";
import { byExercise, countBy, groupBy, inRange, loadRows, parseRange, partName, summary, weekly, weeksIn } from "@/lib/analytics";
import { Bars, Card, Empty, HBars, Legend, RangeTabs, Stats, shortDate } from "../../ui";

export const dynamic = "force-dynamic";

export default async function PartPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string }> }) {
  const id = Number((await params).id);
  const name = await partName(id);
  if (!name) notFound();
  const range = parseRange((await searchParams).range);
  const mine = (await loadRows()).filter((r) => r.topId === id || r.partId === id);
  const rows = inRange(mine, range);
  const s = summary(rows, range);
  const subs = [...new Set(rows.map((r) => r.part))]; // shoulders → front/side delt
  const wk = weekly(rows, Math.min(52, weeksIn(mine, range)), (r) => r.part);
  const labels = countBy([...groupBy(rows, (r) => r.workoutId)].map(([, rs]) => rs[0]), (r) => r.label);
  const exs = byExercise(rows);

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold capitalize">{name}</h1>
      <RangeTabs base={`/analytics/part/${id}`} current={range} />
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
            <HBars rows={Object.entries(labels).sort((a, b) => b[1] - a[1]).map(([l, n]) => ({ label: LABELS[l as keyof typeof LABELS].name, value: n, href: `/analytics/label/${l}`, color: PART_COLOR[name] }))} />
          </Card>
          <Card title="Exercises" sub="Change in estimated 1RM over this range">
            <ul className="divide-y divide-current/10">
              {exs.map((e) => (
                <li key={e.id}>
                  <Link href={`/analytics/exercise/${e.id}`} className="flex items-center justify-between gap-3 py-2">
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
