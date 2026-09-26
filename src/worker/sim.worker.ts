/// <reference lib="webworker" />
import '../engine/hooks';
import { EXECUTION_PROFILES } from '../engine';
import { bundledKb } from '../kb/bundle';
import { compareWeapons, customRunInput, runTeam, teamInput, type BuildOptions } from '../kb';
import type { Request, Response, RunSettings } from './protocol';

const options = (s: RunSettings): BuildOptions => ({
  roster: s.roster,
  cycles: s.cycles,
  profile: { actionDelay: s.actionDelay ?? EXECUTION_PROFILES.relaxed.actionDelay, swapDelay: s.swapDelay ?? EXECUTION_PROFILES.relaxed.swapDelay },
});

self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data;
  const reply = (r: Response) => self.postMessage(r);
  try {
    const kb = bundledKb();
    if (req.type === 'team') {
      const team = kb.teams.get(req.teamId);
      if (!team) throw new Error(`unknown team "${req.teamId}"`);
      reply({ id: req.id, ok: true, type: 'team', result: runTeam(kb, teamInput(team), options(req.settings)) });
    } else if (req.type === 'custom') {
      const input = customRunInput(kb, req.team);
      if (req.rotationJson) input.rotation = JSON.parse(req.rotationJson);
      const { notes, ...run } = input;
      reply({ id: req.id, ok: true, type: 'custom', result: runTeam(kb, run, options(req.settings)), notes });
    } else {
      const team = kb.teams.get(req.teamId);
      if (!team) throw new Error(`unknown team "${req.teamId}"`);
      reply({ id: req.id, ok: true, type: 'compare', result: compareWeapons(kb, teamInput(team), req.characterId, req.candidates, req.baseline, options(req.settings)) });
    }
  } catch (err) {
    reply({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
