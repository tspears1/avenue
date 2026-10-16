# Avenue Tokens Figma plugin

A small, non-destructive importer for generated Avenue Figma variables and effect styles.

## Behavior

The plugin treats `figma-tokens.json` as instructions:

- Missing collections, modes, variables, and effect styles are created.
- Existing managed variables and effect styles are updated.
- Matching values are left unchanged.
- Variables, modes, and styles absent from the artifact are preserved.
- Nothing is deleted.
- Type conflicts block import rather than recreating variables and breaking bindings.
- Source token paths are stored as plugin data for stable identity across renames.
- Schema `0.3.0` optionally accepts `styles.effects`; effect style names are only changed when their `sourcePath` identity is unambiguous.

## Sources

The UI supports:

- A GitHub Pages or raw GitHub URL
- A normal public GitHub file URL, converted to its raw URL
- A local `figma-tokens.json` file

Successful URL imports are remembered with `figma.clientStorage`. URL requests are cache-busted so designers receive the newest Pages deployment.

## Development

Build the plugin:

```bash
pnpm build:tokens-plugin
```

Watch source files:

```bash
pnpm --filter ave-tokens-figma-plugin watch
```

Run the pure importer tests:

```bash
pnpm --filter ave-tokens-figma-plugin test
```

The build writes `build/main.js` and `build/ui.js`. In the Figma desktop app, use **Plugins → Development → Import plugin from manifest…** and choose `manifest.json`.

## Plugin ID

`manifest.json` contains a local-development placeholder ID. Replace it with the ID Figma assigns when the plugin is created or published. Keeping that ID stable is important because document plugin data is scoped to the plugin ID.

## Network access

The development manifest allows GitHub Pages subdomains and `raw.githubusercontent.com`. Before publishing the plugin, narrow the Pages wildcard to the exact organization or custom token domain.

## GitHub Pages feed

`.github/workflows/publish-token-artifact.yml` publishes only:

- `figma-tokens.json`
- `manifest.json`

Enable GitHub Pages with **GitHub Actions** as the source in the repository settings. The token URL will normally be:

```text
https://<organization>.github.io/<repository>/figma-tokens.json
```
