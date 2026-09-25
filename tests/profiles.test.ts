import { describe, expect, it } from 'vitest';
import { EXECUTION_PROFILES, framesToSeconds, secondsToFrames } from '../src/engine';

describe('execution profiles', () => {
  it('relaxed is 18 frames (300 ms) per action and swap', () => {
    expect(EXECUTION_PROFILES.relaxed).toEqual({ actionDelay: 18, swapDelay: 18 });
    expect(framesToSeconds(18)).toBeCloseTo(0.3);
  });
  it('converts seconds to frames at 60 fps', () => {
    expect(secondsToFrames(2.5)).toBe(150);
  });
});
