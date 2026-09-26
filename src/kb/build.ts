import type { Effect } from '../schema/effect';
import type { Roster } from '../schema/roster';
import {
  EXECUTION_PROFILES, buildCharacterInput, type CharacterInput, type EnemyInput, type ExecutionProfile, type MainStats,
} from '../engine';
import type { KbData } from './data';

export const DEFAULT_ENEMY: EnemyInput = {
  level: 100,
  res: { pyro: 0.1, hydro: 0.1, electro: 0.1, cryo: 0.1, anemo: 0.1, geo: 0.1, dendro: 0.1, physical: 0.1 },
};

export interface MemberSpec {
  character: string;
  /** Weapons in order of preference. */
  weapons: string[];
  /** Artifact sets worn (set id → pieces). */
  sets: Record<string, number>;
  /** Main stat alternatives per slot, best first. Falls back to the character's recommended main stats. */
  mainStats?: { sands: string[]; goblet: string[]; circlet: string[] };
}

export interface BuildOptions {
  /** Owned characters/weapons and their levels. Without it: everything C0, 9/9/9, R1, all weapons owned. */
  roster?: Roster;
  enemy?: EnemyInput;
  profile?: ExecutionProfile;
  cycles?: number;
  /** Team has the Lunar-Charged (Moonsign) condition. */
  lunarCharged?: boolean;
}

export interface BuiltMember {
  input: CharacterInput;
  mains: MainStats[];
  weaponId: string;
  refinement: number;
}

/** Sets → their 2pc/4pc effects. */
export function setEffects(kb: KbData, sets: Record<string, number>): Effect[] {
  const out: Effect[] = [];
  for (const [id, n] of Object.entries(sets)) {
    const set = kb.artifacts.get(id);
    if (!set) throw new Error(`unknown artifact set "${id}"`);
    if (n >= 2) out.push(...set.pieces['2'].effects);
    if (n >= 4) out.push(...set.pieces['4'].effects);
  }
  return out;
}

/** Highest base ATK weapon of a type, preferring owned ones. */
export function defaultWeapon(kb: KbData, type: string, owned: (id: string) => boolean): string {
  const list = [...kb.weapons.values()].filter((w) => w.type === type).sort((a, b) => b.baseAtk.lv90 - a.baseAtk.lv90);
  const pick = list.find((w) => owned(w.id)) ?? list[0];
  if (!pick) throw new Error(`no ${type} weapons in the knowledge base`);
  return pick.id;
}

export function buildMember(kb: KbData, m: MemberSpec, opts: BuildOptions, notices: string[]): BuiltMember {
  const c = kb.characters.get(m.character);
  if (!c) throw new Error(`unknown character "${m.character}"`);
  const roster = opts.roster;
  const assumeAll = roster?.settings.assumeAllWeapons ?? true;
  const owned = (id: string) => assumeAll || (roster?.weapons[id]?.owned ?? false);

  let weaponId = m.weapons.find(owned);
  if (!weaponId && m.weapons.length === 0) {
    weaponId = defaultWeapon(kb, c.weaponType, owned);
    notices.push(`${c.id}: no recommended weapon in the knowledge base; using ${weaponId} (highest base ATK of the type)`);
  }
  if (!weaponId) {
    weaponId = m.weapons[0];
    if (!weaponId) throw new Error(`no weapon for ${c.id}`);
    notices.push(`${c.id}: none of the listed weapons is owned; using ${weaponId} anyway`);
  }
  const weapon = kb.weapons.get(weaponId);
  if (!weapon) throw new Error(`unknown weapon "${weaponId}"`);
  const refinement = roster?.weapons[weaponId]?.refinement ?? 1;

  const rc = roster?.characters[c.id];
  const input = buildCharacterInput(c, {
    weapon, refinement,
    constellation: rc?.constellation ?? 0,
    talentLevels: rc?.talents ?? [9, 9, 9],
    artifactEffects: setEffects(kb, m.sets),
  });

  const ms = m.mainStats ?? c.recommended.mainStats;
  if (!ms) throw new Error(`no main stats for ${c.id}: give them in the team or in the character's recommended.mainStats`);
  // Preferred first: (first Sands, first Goblet, each Circlet), then the same with the other Sands options.
  const mains: MainStats[] = ms.sands.flatMap((sands) => ms.circlet.map((circlet) => ({ sands, goblet: ms.goblet[0]!, circlet })));
  return { input, mains, weaponId, refinement };
}

export const relaxed = EXECUTION_PROFILES.relaxed;
