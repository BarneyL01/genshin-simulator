// Draft handling for integer inputs. The field keeps the raw text while the user types
// (so an empty or out-of-range intermediate value is allowed) and only commits values
// inside [lo, hi]. On blur an empty or out-of-range draft reverts to the current value.

/** Keep digits only. Mobile keyboards can insert spaces, dots or minus signs. */
export const sanitizeInt = (text: string): string => text.replace(/\D/g, '');

/** Value to commit while typing, or null if the draft is empty or out of range. */
export function draftValue(text: string, lo: number, hi: number): number | null {
  if (text === '') return null;
  const n = Number.parseInt(text, 10);
  return n >= lo && n <= hi ? n : null;
}

/** Value to keep when the field loses focus: the draft if valid, otherwise the current value. */
export function blurValue(text: string, lo: number, hi: number, current: number): number {
  return draftValue(text, lo, hi) ?? current;
}
