import { MAX_PUSH } from "./sync-limits";
import type { LiftDB, LSet, LWorkout } from "./local-db";
import type { SetRow, SyncRequest, SyncResponse, WorkoutRow } from "./types";

export type Transport = (req: SyncRequest) => Promise<SyncResponse>;
export class AuthError extends Error {}
export type SyncStatus = { syncing: boolean; error: string | null; auth: boolean; lastSyncAt: number | null };

export const fetchTransport: Transport = async (req) => {
  const res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
  if (res.status === 401) throw new AuthError("Signed out");
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Sync failed (${res.status})`);
  return res.json();
};

const strip = <T extends { dirty: 0 | 1 }>({ dirty, ...row }: T) => {
  void dirty;
  return row;
};

// State-based sync: dirty rows push, phir rev cursor se pull. Last-write-wins (updatedAt), idempotent
export function makeSync(db: LiftDB, transport: Transport) {
  let status: SyncStatus = { syncing: false, error: null, auth: false, lastSyncAt: null };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    listeners.forEach((l) => l());
  };

  // Server ka response local me apply: bheje hue rows clean (agar beech me edit nahi hui), baaki remote wins unless local newer+dirty
  async function apply(res: SyncResponse, sentW: LWorkout[], sentS: LSet[]) {
    await db.transaction("rw", db.workouts, db.sets, db.meta, async () => {
      for (const [table, sent] of [[db.workouts, sentW], [db.sets, sentS]] as const) {
        for (const r of sent) {
          const cur = await (table as typeof db.workouts).get(r.id);
          if (cur && cur.updatedAt === r.updatedAt) await (table as typeof db.workouts).update(r.id, { dirty: 0 });
        }
      }
      for (const r of res.workouts) {
        const cur = await db.workouts.get(r.id);
        if (!(cur?.dirty && cur.updatedAt > r.updatedAt)) await db.workouts.put({ ...r, dirty: 0 });
      }
      for (const r of res.sets) {
        const cur = await db.sets.get(r.id);
        if (!(cur?.dirty && cur.updatedAt > r.updatedAt)) await db.sets.put({ ...r, dirty: 0 });
      }
      await db.meta.put({ key: "rev", value: res.cursor });
    });
  }

  async function once() {
    const dirtyW = await db.workouts.where("dirty").equals(1).toArray();
    // parents (main sets) pehle — server FK
    const dirtyS = (await db.sets.where("dirty").equals(1).toArray()).sort((a, b) => Number(!!a.parentSetId) - Number(!!b.parentSetId));
    let cursor = ((await db.meta.get("rev"))?.value as number | undefined) ?? 0;
    const items = [...dirtyW.map((r) => ({ w: r })), ...dirtyS.map((r) => ({ s: r }))];

    // chunks me push (kam se kam ek request, pull ke liye)
    for (let i = 0; i === 0 || i < items.length; i += MAX_PUSH) {
      const part = items.slice(i, i + MAX_PUSH);
      const sentW = part.flatMap((p) => ("w" in p ? [p.w] : []));
      const sentS = part.flatMap((p) => ("s" in p ? [p.s] : []));
      const res = await transport({ since: cursor, workouts: sentW.map(strip) as WorkoutRow[], sets: sentS.map(strip) as SetRow[] });
      await apply(res, sentW, sentS);
      cursor = res.cursor;
      let more = res.more;
      while (more) {
        const next = await transport({ since: cursor, workouts: [], sets: [] });
        await apply(next, [], []);
        cursor = next.cursor;
        more = next.more;
      }
    }
  }

  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function sync(): Promise<void> {
    if (running) {
      again = true; // chalte sync ke baad ek aur
      return running;
    }
    // Browser offline hai to request bhejna hi nahi (console noise + battery)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      set({ syncing: false, error: "Offline" });
      return Promise.resolve();
    }
    running = (async () => {
      set({ syncing: true });
      try {
        do {
          again = false;
          await once();
        } while (again);
        set({ syncing: false, error: null, auth: false, lastSyncAt: Date.now() });
      } catch (e) {
        const auth = e instanceof AuthError;
        const offline = e instanceof TypeError; // fetch network failure
        set({ syncing: false, auth, error: auth ? "Signed out" : offline ? "Offline" : e instanceof Error ? e.message : "Sync failed" });
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    sync,
    // Mutations ke baad: thoda ruk ke ek hi sync (burst me kai sets)
    schedule(ms = 600) {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), ms);
    },
    getStatus: () => status,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    pending: async () => (await db.workouts.where("dirty").equals(1).count()) + (await db.sets.where("dirty").equals(1).count()),
  };
}
