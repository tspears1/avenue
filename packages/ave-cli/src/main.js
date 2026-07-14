import * as prompts from '@clack/prompts';
import kleur from 'kleur';
import * as semver from 'semver';
import * as utils from './utils.js';

export * from '@clack/prompts';
export * from 'kleur';
export * from 'semver';
export * as utils from './utils.js';

export { prompts, kleur, semver };

const toolbox = { prompts, kleur, semver, utils };

export default toolbox;