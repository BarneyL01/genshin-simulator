import { constantsFile, icdFile, reactionsFile } from '../schema/mechanics';
import constantsJson from '../../kb/mechanics/constants.json';
import icdJson from '../../kb/mechanics/icd.json';
import reactionsJson from '../../kb/mechanics/reactions.json';

/** Mechanics come from the KB (kb/mechanics/*.json), validated at load. */
export const REACTIONS = reactionsFile.parse(reactionsJson);
export const ICD = icdFile.parse(icdJson);
export const CONSTANTS = constantsFile.parse(constantsJson);
