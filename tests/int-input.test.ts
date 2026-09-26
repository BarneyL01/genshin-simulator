import { describe, expect, it } from 'vitest';
import { blurValue, draftValue, sanitizeInt } from '../src/ui/intInput';

describe('integer input drafts (talent levels 1-15)', () => {
  it('keeps an empty draft uncommitted instead of falling back to a default', () => {
    expect(draftValue('', 1, 15)).toBeNull();
    expect(blurValue('', 1, 15, 6)).toBe(6);
  });

  it('commits in-range values while typing', () => {
    expect(draftValue('1', 1, 15)).toBe(1);
    expect(draftValue('10', 1, 15)).toBe(10);
  });

  it('does not clamp appended digits to the max', () => {
    expect(draftValue('98', 1, 15)).toBeNull();
    expect(blurValue('98', 1, 15, 9)).toBe(9);
    expect(blurValue('0', 1, 15, 9)).toBe(9);
  });

  it('strips non-digits from mobile keyboards', () => {
    expect(sanitizeInt(' 1.0-')).toBe('10');
  });
});
