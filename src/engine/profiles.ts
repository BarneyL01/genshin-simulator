/** Execution profiles. All values in frames (60 fps). See docs/SIMULATION.md. */
export interface ExecutionProfile {
  actionDelay: number;
  swapDelay: number;
}

export const EXECUTION_PROFILES = {
  framePerfect: { actionDelay: 0, swapDelay: 0 },
  relaxed: { actionDelay: 18, swapDelay: 18 },
} as const satisfies Record<string, ExecutionProfile>;

export const FPS = 60;
export const framesToSeconds = (frames: number): number => frames / FPS;
export const secondsToFrames = (seconds: number): number => Math.round(seconds * FPS);
