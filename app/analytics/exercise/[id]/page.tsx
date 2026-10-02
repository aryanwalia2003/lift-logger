import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exerciseSessions, inRange, loadRows, parseRange, repBuckets } from "@/lib/analytics";
import { Card, Empty, HBars, LineChart, RangeTabs, Stats, kg, shortDate } from "../../ui";

export const dynamic = "force-dynamic";

export default async function ExercisePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string }> }) {
  const id = Number((await params).id);
  const ex = db.select().from(exercises).where(eq(exercises.id, id)).get();
  if (!ex) notFound();
  const range = parseRange((await searchParams).range);
  const mine = loadRows().filter((r) => r.exerciseId === id);
  const all = exerciseSessions(mine); // PR flag poori history se
  const ss = inRange(all, range);
  const rows = inRange(mine, range);
  const first = ss[0], last = ss.at(-1);

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold capitalize">{ex.name}</h1>
      <RangeTabs base={`/analytics/exercise/${id}`} current={range} />
      {!last ? <Card title="Kuch nahi mila"><Empty>Is range me ye exercise nahi hui.</Empty></Card> : (
        <>
          <Stats items={[
            ["Best e1RM", kg(Math.max(...ss.map((s) => s.e1rm)))],
            ["Heaviest", kg(Math.max(...ss.map((s) => s.topWeight)))],
            ["Sessions", String(ss.length)],
            ["Change", ss.length > 1 ? `${last.e1rm >= first.e1rm ? "▲" : "▼"} ${Math.abs((last.e1rm / first.e1rm - 1) * 100).toFixed(1)}%` : "—"],
          ]} />
          <Card title="Estimated 1RM" sub="Har session ka best set, Epley formula">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.e1rm }))} />
          </Card>
          <Card title="Top weight" sub="Session me sabse bhaari set">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.topWeight }))} />
          </Card>
          <Card title="Volume per session" sub="Weight × reps">
            <LineChart points={ss.map((s) => ({ x: s.date, y: s.volume }))} />
          </Card>
          <Card title="Rep ranges" sub="Total sets">
            <HBars rows={repBuckets(rows)} />
          </Card>
          <Card title="History" sub="PR = naya estimated 1RM best · ↳ = drop set, SS = superset">
            <ul className="divide-y divide-current/10">
              {[...ss].reverse().slice(0, 20).map((s) => (
                <li key={s.id}>
                  <Link href={`/workout/${s.id}`} className="block py-2 text-sm">
                    <span className="flex justify-between"><span>{shortDate(s.date)}{s.sets.some((r) => r.supersetId) && <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs">SS</span>}</span>{s.pr && <span className="font-semibold">🏆 PR</span>}</span>
                    <span className="text-xs opacity-60">{s.sets.map((r) => `${r.isDrop ? "↳" : ""}${r.weight}×${r.reps}`).join(" · ")}</span>
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
