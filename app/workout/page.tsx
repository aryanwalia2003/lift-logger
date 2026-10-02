import { Suspense } from "react";
import { WorkoutClient } from "./workout-client";

// Static shell (offline cache ho sakta hai) — workout id query se, data local DB se
export default function Page() {
  return (
    <Suspense>
      <WorkoutClient />
    </Suspense>
  );
}
