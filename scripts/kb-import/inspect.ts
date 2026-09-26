import { db } from './lib';

/**
 * Authoring aid: print what genshin-db knows about a character or weapon.
 *   npm run kb:inspect -- "Xiangling"
 *   npm run kb:inspect -- weapon "Engulfing Lightning"
 */
const args = process.argv.slice(2);
const isWeapon = args[0] === 'weapon';
const name = (isWeapon ? args[1] : args[0]) ?? '';
if (!name) {
  console.error('usage: inspect.ts [weapon] <name>');
  process.exit(2);
}

if (isWeapon) {
  const w = db.weapons(name);
  console.log(w.name, w.weaponText, `${w.rarity}★`, w.version, w.mainStatText, JSON.stringify(w.stats(90)));
  console.log(w.effectName, '|', w.effectTemplateRaw);
  for (let r = 1; r <= 5; r++) console.log(`R${r}`, JSON.stringify(w[`r${r}`].values));
} else {
  const t = db.talents(name);
  const k = db.constellations(name);
  const c = db.characters(name);
  console.log(c.name, c.elementText, c.weaponText, `${c.rarity}★`, c.version, c.substatText, JSON.stringify(c.stats(90)));
  for (const key of ['combat1', 'combat2', 'combat3'] as const) {
    console.log('##', key, t[key].name);
    console.log(t[key].attributes.labels.map((l: string, i: number) => `${i}: ${l}`).join('\n'));
  }
  for (const key of ['passive1', 'passive2', 'passive3', 'passive4'] as const) if (t[key]) console.log('##', key, t[key].name, '|', t[key].description);
  for (let i = 1; i <= 6; i++) console.log(`## C${i}`, k[`c${i}`].name, '|', k[`c${i}`].description);
}
