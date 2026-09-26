export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const signedPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
export const secs = (frames: number) => `${(frames / 60).toFixed(1)} s`;
export const nameOf = (id: string) => id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

export const ELEMENT_COLOR: Record<string, string> = {
  pyro: '#e0653a', hydro: '#3a7ee0', electro: '#a05ad6', cryo: '#4ab9d6', anemo: '#3bb98f', geo: '#c9a227', dendro: '#5aa63a', physical: '#8a8f98', reaction: '#666',
};

/** Stable colour per character for charts. */
const PALETTE = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'];
export const charColor = (index: number) => PALETTE[index % PALETTE.length]!;
