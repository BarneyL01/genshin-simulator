export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const signedPct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
export const secs = (frames: number) => `${(frames / 60).toFixed(1)} s`;
export const nameOf = (id: string) => id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro', 'physical'];
/** Theme-aware element colour (see --el-* in index.css). */
export const ELEMENT_COLOR: Record<string, string> = Object.fromEntries([...ELEMENTS.map((e) => [e, `var(--el-${e})`]), ['reaction', 'var(--md-outline)']]);
export const elementColor = (el: string) => ELEMENT_COLOR[el] ?? 'var(--md-outline)';
/** 5 stars gold, 4 stars purple (the in-game convention). */
export const rarityColor = (rarity: number) => (rarity >= 5 ? 'var(--rarity-5)' : 'var(--rarity-4)');

/** Stable colour per character for charts: theme-aware CSS variables (see --chart-N in index.css). */
export const charColor = (index: number) => `var(--chart-${(index % 8) + 1})`;
