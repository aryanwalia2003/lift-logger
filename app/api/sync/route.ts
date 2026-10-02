import { db } from "@/db";
import { applySync, SyncError } from "@/lib/sync-server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    return Response.json(await applySync(db, body));
  } catch (e) {
    if (e instanceof SyncError) return Response.json({ error: e.message }, { status: 400 });
    console.error(e);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
