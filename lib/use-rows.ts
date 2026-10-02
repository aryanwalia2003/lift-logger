"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { store } from "./client";

// Local DB se analytics rows (live — sync ya naya set aate hi update). undefined = loading
export const useRows = () => useLiveQuery(() => store.loadRows(), []);
