# ave-cli

Simple shared toolbox for Avenue CLI scripts with one import surface.

## Install

```bash
pnpm add ave-cli
```

## Usage

### Default toolbox import

```js
import cli from 'ave-cli';

cli.prompts.intro(cli.kleur.cyan('Avenue CLI'));
const msg = cli.utils.success('Done');
```

### Named imports

```js
import { intro, outroSuccess, utils, semver } from 'ave-cli';

intro('Create Component');
console.log(utils.formatPath('packages/ave-ui'));
outroSuccess(`semver: ${semver.valid('1.2.3')}`);
```

### What is exported

- `default`: `{ prompts, kleur, semver, utils }`
- `prompts`, `kleur`, `semver`
- `utils` namespace
- direct re-exports from `@clack/prompts`, `kleur`, and `semver`
