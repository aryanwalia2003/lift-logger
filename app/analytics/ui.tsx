import Link from "next/link";
import { LABELS, PART_COLOR, type Label } from "@/lib/catalog";
import { RANGES, type Range } from "@/lib/analytics";

const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)"];
const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.round(n * 10) / 10));
export const kg = (n: number) => `${fmt(n)} kg`;
export const shortDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const weekday = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const niceMax = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(v || 1));
  return ([1, 2, 5, 10].map((m) => m * p).find((m) => m >= v) ?? v);
};

export function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-current/15 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export const Empty = ({ children = "No data yet — log some sets." }: { children?: React.ReactNode }) => (
  <p className="py-4 text-center text-sm opacity-60">{children}</p>
);

export function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-2xl border border-current/15 p-3">
          <div className="text-xs opacity-60">{k}</div>
          <div className="text-xl font-bold tabular-nums">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function RangeTabs({ current, onChange }: { current: Range; onChange: (r: Range) => void }) {
  return (
    <div className="mt-3 flex gap-1 rounded-full border border-current/15 p-1 text-sm">
      {(Object.keys(RANGES) as Range[]).map((r) => (
        <button key={r} type="button" onClick={() => onChange(r)}
          className={`flex-1 rounded-full py-1.5 text-center ${r === current ? "bg-foreground text-background" : "opacity-70"}`}>
          {RANGES[r]}
        </button>
      ))}
    </div>
  );
}

export const Loading = () => <p className="mt-6 text-center text-sm opacity-60">Loading…</p>;
export const Missing = ({ what }: { what: string }) => <p className="mt-6 text-center text-sm opacity-60">{what} not found.</p>;

export function Legend({ keys }: { keys: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5 capitalize">
          <i className="inline-block size-2.5 rounded-sm" style={{ background: PART_COLOR[k] ?? SERIES[0] }} />{k}
        </span>
      ))}
    </div>
  );
}

// Vertical (stacked) bars. Ek hi key = single series
export function Bars({ data, unit = "", color = (k: string) => PART_COLOR[k] ?? SERIES[0] }: {
  data: { x: string; tip?: string; segs: { key: string; v: number }[] }[];
  unit?: string;
  color?: (key: string) => string;
}) {
  const W = 320, H = 150, L = 30, B = 20, T = 14;
  const totals = data.map((d) => d.segs.reduce((a, s) => a + s.v, 0));
  const max = niceMax(Math.max(...totals, 1));
  const slot = (W - L) / data.length, bw = Math.min(slot * 0.7, 28);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const every = Math.ceil(data.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="bar chart">
      {[0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeOpacity=".12" />
          <text x={L - 4} y={y(max * f) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity=".6">{fmt(max * f)}</text>
        </g>
      ))}
      <line x1={L} x2={W} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".3" />
      {data.map((d, i) => {
        const x = L + slot * i + (slot - bw) / 2;
        let acc = 0;
        return (
          <g key={i}>
            <title>{`${d.tip ?? d.x}: ${fmt(totals[i])}${unit}`}</title>
            {d.segs.filter((s) => s.v > 0).map((s) => {
              const top = y(acc + s.v), h = y(acc) - top;
              acc += s.v;
              return <rect key={s.key} x={x} y={top} width={bw} height={Math.max(h - 1, 0)} rx="1.5" fill={color(s.key)} />;
            })}
            {data.length <= 8 && totals[i] > 0 && (
              <text x={x + bw / 2} y={y(totals[i]) - 3} textAnchor="middle" fontSize="9" fill="currentColor">{fmt(totals[i])}</text>
            )}
            {i % every === 0 && (
              <text x={Math.min(x + bw / 2, W - 14)} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity=".6">{d.x}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Time-scaled line; last point aur max point labeled
export function LineChart({ points, unit = "kg" }: { points: { x: string; y: number }[]; unit?: string }) {
  if (points.length < 2) return <Empty>Need at least 2 sessions to show a trend.</Empty>;
  const W = 320, H = 150, L = 34, R = 14, T = 16, B = 20;
  const ys = points.map((p) => p.y);
  const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.15 || hi * 0.1 || 1;
  const min = Math.max(0, lo - pad), max = hi + pad;
  const t0 = Date.parse(points[0].x), t1 = Date.parse(points.at(-1)!.x) || t0 + 1;
  const px = (x: string) => L + ((Date.parse(x) - t0) / (t1 - t0 || 1)) * (W - L - R);
  const py = (v: number) => T + (H - T - B) * (1 - (v - min) / (max - min));
  const maxI = ys.indexOf(hi), lastI = points.length - 1;
  const label = (i: number, anchor: "start" | "middle" | "end") => (
    <text x={Math.min(Math.max(px(points[i].x), L + 14), W - R - 6)} y={py(points[i].y) - 8} textAnchor={anchor} fontSize="10" fontWeight="600" fill="currentColor">
      {fmt(points[i].y)}
    </text>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="trend chart">
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity=".12" />
          <text x={L - 4} y={py(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity=".6">{fmt(Math.round(v))}</text>
        </g>
      ))}
      <polyline points={points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r="4" fill="var(--s1)" stroke="var(--background)" strokeWidth="2">
          <title>{`${shortDate(p.x)}: ${fmt(p.y)} ${unit}`}</title>
        </circle>
      ))}
      {label(lastI, "end")}
      {maxI !== lastI && label(maxI, "middle")}
      <text x={L} y={H - 6} fontSize="9" fill="currentColor" opacity=".6">{shortDate(points[0].x)}</text>
      <text x={W - R} y={H - 6} textAnchor="end" fontSize="9" fill="currentColor" opacity=".6">{shortDate(points.at(-1)!.x)}</text>
    </svg>
  );
}

// Horizontal bars (HTML — text wrap/truncate mobile pe behtar)
export function HBars({ rows, unit = "" }: {
  rows: { label: string; value: number; href?: string; color?: string; sub?: string }[];
  unit?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="w-28 shrink-0 truncate text-sm capitalize">{r.label}</span>
            <span className="h-2 flex-1 rounded-full bg-current/10">
              <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? SERIES[0] }} />
            </span>
            <span className="w-14 shrink-0 text-right text-sm tabular-nums">{fmt(r.value)}{unit}</span>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? <Link href={r.href} className="flex items-center gap-3 py-0.5">{inner}</Link> : <div className="flex items-center gap-3 py-0.5">{inner}</div>}
            {r.sub && <div className="pl-[7.75rem] text-xs opacity-60">{r.sub}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// Hafte × 7 din, har cell me us din ka label
export function ScheduleGrid({ weeks, today }: { weeks: { week: string; days: { date: string; labels: Label[] }[] }[]; today: string }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[2.75rem_repeat(7,1fr)] gap-1 text-center text-[10px] opacity-60">
        <span />{"MTWTFSS".split("").map((d, i) => <span key={i}>{d}</span>)}
      </div>
      {weeks.map((w) => (
        <div key={w.week} className="grid grid-cols-[2.75rem_repeat(7,1fr)] gap-1">
          <span className="self-center text-[10px] opacity-60">{shortDate(w.week)}</span>
          {w.days.map((d) => (
            <div key={d.date} title={`${shortDate(d.date)}: ${d.labels.map((l) => LABELS[l].name).join(" + ") || "rest"}`}
              className={`flex h-9 items-center justify-center rounded-md text-[9px] font-semibold leading-none ${d.labels.length ? "text-white" : "bg-current/5"} ${d.date === today ? "ring-2 ring-foreground" : ""}`}
              style={d.labels.length ? { background: "var(--s1)" } : undefined}>
              {d.labels.map((l) => LABELS[l].short).join("+")}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
