import { registerHook } from './api';

/**
 * Marker hook for characters whose passive turns Superconduct into Stellar-Conduct ("Stellar Jubilee":
 * Cryo Traveler, Sandrone, ...). It does nothing itself: its presence in the team switches the reaction
 * engine to Stellar-Conduct (src/engine/reactions.ts, kb/mechanics/reactions.json).
 */
registerHook('stellar-conduct', () => undefined);
