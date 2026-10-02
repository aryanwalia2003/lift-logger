"use client";
import { LiftDB } from "./local-db";
import { fetchTransport, makeSync } from "./sync";
import { makeStore } from "./store";

// Browser singletons: local DB + sync engine + store (writes ke baad sync schedule)
export const localDb = new LiftDB();
export const engine = makeSync(localDb, fetchTransport);
export const store = makeStore(localDb, () => engine.schedule());
