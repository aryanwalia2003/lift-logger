"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { engine } from "@/lib/client";

const PAGES = ["/", "/workout", "/analytics", "/analytics/label", "/analytics/part", "/analytics/exercise"];

// App start pe: SW register, sync loop (online/visible/interval), aur ek chhota status bar
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const onLogin = usePathname() === "/login";
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus, engine.getStatus);
  const pending = useLiveQuery(() => engine.pending(), [], 0);
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if (onLogin) return; // login page pe sync nahi (401 noise)
    void engine.sync();
    const tick = () => document.visibilityState === "visible" && void engine.sync();
    const id = setInterval(tick, 30_000);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", tick);

    // Offline ke liye pages + assets cache me (sirf production, ek baar din me)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      // Flag tabhi jab SW ne sach me pages cache kiye (login se pehle warm fail hota hai)
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "warmed" && e.data.n >= PAGES.length) localStorage.setItem("warmed", String(Date.now()));
      });
      navigator.serviceWorker.register("/sw.js").then(async () => {
        const reg = await navigator.serviceWorker.ready;
        if (Date.now() - Number(localStorage.getItem("warmed") ?? 0) > 864e5) reg.active?.postMessage({ type: "warm", urls: PAGES });
      }).catch(() => {});
    }
    return () => {
      clearInterval(id);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [onLogin]);

  let label = "Synced";
  if (status.auth) label = "Sign in to sync";
  else if (!online) label = pending ? `Offline · ${pending} pending` : "Offline";
  else if (status.syncing) label = "Syncing…";
  else if (status.error) label = `Sync error${pending ? ` · ${pending} pending` : ""}`;
  else if (pending) label = `${pending} pending`;

  return (
    <>
      {!onLogin && <div className="flex h-6 items-center justify-end px-4 text-[11px] opacity-60">
        {status.auth ? (
          <Link href="/login" className="underline">{label}</Link>
        ) : (
          <button onClick={() => void engine.sync()} title={status.error ?? undefined} aria-label="Sync status. Tap to sync now">{label}</button>
        )}
      </div>}
      {children}
    </>
  );
}

