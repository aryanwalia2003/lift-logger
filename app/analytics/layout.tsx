import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-12 pt-4">
      <nav className="flex justify-between text-sm opacity-70">
        <Link href="/">← Workout</Link>
        <Link href="/analytics">Analytics</Link>
      </nav>
      {children}
    </main>
  );
}
