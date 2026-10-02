import Link from "next/link";
import { LABELS, PART_COLOR } from "@/lib/catalog";
import { byExercise, byLabel, byPart, inRange, loadRows, parseRange, prs, schedule, summary, supersetPairs, today, weekly, weeksIn } from "@/lib/analytics";
import { Bars, Card, Empty, HBars, Legend, RangeTabs, ScheduleGrid, Stats, kg, shortDate } from "./ui";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const all = await loadRows();
  const rows = inRange(all, range);
  const s = summary(rows, range);
  const parts = byPart(rows);
  const weeks = Math.min(52, weeksIn(all, range));
  const wk = weekly(rows, weeks);
  const partKeys = parts.map((p) => p.name);
  const recentPrs = prs(all).filter((p) => rows.length && inRange([p], range).length).slice(0, 6);
  const exs = byExercise(all);

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold">Analytics</h1>
      <RangeTabs base="/analytics" current={range} />
      {rows.length === 0 ? <Card title="Nothing found"><Empty /></Card> : (
        <>
          <Stats items={[
            ["Workouts", String(s.workouts)],
            ["Per week", s.perWeek.toFixed(1)],
            ["Sets", String(s.sets)],
            ["Volume", kg(s.volume)],
          ]} />

          <Card title="Schedule" sub="Last 8 weeks — what you trained each day">
            <ScheduleGrid weeks={schedule(all, 8)} today={today()} />
          </Card>

          <Card title="Weekly sets" sub="By body part">
            <Bars data={wk.map((w) => ({ x: shortDate(w.week), tip: `Week of ${shortDate(w.week)}`, segs: partKeys.map((k) => ({ key: k, v: w.parts[k] ?? 0 })) }))} unit=" sets" />
            <Legend keys={partKeys} />
          </Card>

          <Card title="Sessions by label" sub="Tap a label for its analysis">
            <HBars rows={byLabel(rows).map((l) => ({ label: LABELS[l.label].name, value: l.count, href: `/analytics/label/${l.label}`, sub: `avg ${Math.round(l.avgSets)} sets · ${l.everyDays ? `every ${l.everyDays.toFixed(1)} days` : "once"}` }))} />
          </Card>

          <Card title="Sets by body part">
            <HBars rows={parts.map((p) => ({ label: p.name, value: p.sets, href: `/analytics/part/${p.id}`, color: PART_COLOR[p.name], sub: `${p.sessions} sessions · last ${shortDate(p.last)}` }))} />
          </Card>

          {(s.drops > 0 || s.rounds > 0) && (
            <Card title="Drop sets & supersets" sub={`${s.drops} drop sets · ${s.rounds} superset rounds`}>
              {s.rounds > 0 && <HBars rows={supersetPairs(rows).slice(0, 6).map((p) => ({ label: p.pair, value: p.rounds }))} unit=" rounds" />}
            </Card>
          )}

          <Card title="Recent PRs" sub="New estimated 1RM best">
            {recentPrs.length === 0 ? <Empty>No PRs in this range.</Empty> : (
              <ul className="divide-y divide-current/10">
                {recentPrs.map((p) => (
                  <li key={p.exerciseId + p.date}>
                    <Link href={`/analytics/exercise/${p.exerciseId}`} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0"><span className="block truncate text-sm capitalize">{p.exercise}</span><span className="text-xs opacity-60">{shortDate(p.date)} · {p.best.weight} × {p.best.reps}</span></span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{Math.round(p.e1rm)} kg</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Card title="Exercises" sub="Open a body part, then tap an exercise">
        {exs.length === 0 ? <Empty /> : byPart(all).map((p) => (
          <details key={p.id} className="border-b border-current/10 py-1 last:border-0">
            <summary className="flex cursor-pointer items-center gap-2 py-2 text-sm capitalize">
              <i className="size-2.5 rounded-sm" style={{ background: PART_COLOR[p.name] }} />{p.name}
              <span className="ml-auto opacity-60">{exs.filter((e) => e.topId === p.id).length}</span>
            </summary>
            <ul>
              {exs.filter((e) => e.topId === p.id).map((e) => (
                <li key={e.id}>
                  <Link href={`/analytics/exercise/${e.id}`} className="flex justify-between gap-3 py-2 pl-5 text-sm">
                    <span className="truncate capitalize">{e.name}</span><span className="shrink-0 opacity-60">{e.sets} sets</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Card>
    </>
  );
}
