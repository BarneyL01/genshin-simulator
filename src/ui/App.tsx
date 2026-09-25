import { EXECUTION_PROFILES } from '../engine/profiles';

export function App() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Genshin Team Simulator</h1>
      <p className="mt-2 text-slate-600">
        Skeleton (M1). Default execution profile: Relaxed ({EXECUTION_PROFILES.relaxed.actionDelay} frames).
      </p>
    </main>
  );
}
