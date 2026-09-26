import { createKb, type KbData } from './data';

/** The KB bundled into the app (Vite). Not usable from Node: scripts and tests use `createKb` with files they read. */
const modules = import.meta.glob('../../kb/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const under = (dir: string) =>
  Object.entries(modules).filter(([path]) => path.includes(`/kb/${dir}/`)).map(([, v]) => v);

let cached: KbData | undefined;
export function bundledKb(): KbData {
  cached ??= createKb({
    meta: modules['../../kb/meta.json'],
    characters: under('characters'),
    weapons: under('weapons'),
    artifacts: under('artifacts'),
    teams: under('teams'),
    enemies: under('enemies'),
  });
  return cached;
}
