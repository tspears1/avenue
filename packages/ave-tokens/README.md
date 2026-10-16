# ave-tokens

Avenue's designer-owned token source and platform build pipeline.

## Source of truth

Designers edit the YAML files in `tokens/`:

- `settings.yaml` — root sizing and fluid breakpoint defaults
- `ratio.yaml` — aspect ratios
- `color.yaml` — color palettes
- `typography.yaml` — font sizes, weights, families, line heights, and tracking
- `dimensions.yaml` — borders, radii, sizes, icons, controls, and spacing
- `layout.yaml` — breakpoints, containers, z-index, and layout spacing
- `effects.yaml` — elevation and shadows
- `motion.yaml` — durations

Do not edit `tokens.json` directly. It is the generated canonical token document consumed by platform transformers and records its build time as an ISO-8601 UTC `generatedAt` extension.

## Authoring values

Use CSS-like scalar values:

```yaml
size:
  "1": 1rem

border:
  width:
    thin: 1px

color:
  neutral:
    "500": oklch(58% 0.007 270)
```

Use a scalar dimension for a static value:

```yaml
fontSize:
  heading:
    "6": 1.25rem
```

Use `min` and `max` for a fluid value:

```yaml
fontSize:
  heading:
    "6": { min: 1.25rem, max: 1.75rem }
```

Static values in responsive Figma collections are duplicated across all breakpoint modes. Fluid values are interpolated at each breakpoint.

Use a quoted token path for an alias:

```yaml
space:
  md: "{size.3}"
```

A shadow token may contain one layer as an object or multiple layers as an array:

```yaml
elevation:
  medium:
    - color: oklch(0% 0 0 / 8%)
      offsetX: 0px
      offsetY: 1px
      blur: 2px
      spread: 0px
    - color: oklch(0% 0 0 / 12%)
      offsetX: 0px
      offsetY: 4px
      blur: 12px
      spread: 0px
```

Every layer must define exactly `color`, `offsetX`, `offsetY`, `blur`, and `spread`. Multi-layer shadows remain arrays in canonical tokens, serialize naturally as comma-separated CSS shadows, and become multi-effect Figma Effect Styles.

## Unit rules

Authoring units are defined by the shared registry exported from `ave-tokens/rules`. The current vocabulary is:

| Quantity | Units | Figma conversion |
|---|---|---|
| Length | `px`, `rem`, `em`, `ch` | `px` passes through, `rem` uses `rootFontSize`, and contextual `em`/`ch` values are explicitly unsupported when pixels are required |
| Time | `ms`, `s` | Both convert to milliseconds when requested |

Each rule declares its canonical symbol, true lexical aliases, quantity, family, CSS serialization capability, conversions, and required context. Adding a unit requires defining and registering a rule plus contract tests; parser and platform switches should not be edited independently.

Aliases are only for symbols with identical semantics in every context. For example, `vw` and `vi` must be separate future rules because physical viewport width and logical viewport inline size differ in vertical writing modes.

## Expressions

The compiler recognizes a reserved expression shape for future `min`, `max`, `calc`, `round`, and `mod` operators. Expressions are intentionally rejected until their unit validation and platform behavior are implemented.

## Transformation configuration

The JSON files in `schemas/` are executable routing configuration, not authoring documentation or full JSON Schemas. They deliberately contain only decisions that can change how values are routed:

- `source-transform.json` maps each YAML group to a canonical `namespace`, token `type`, optional `behavior`, and path-specific `overrides`.
- `figma-transform.json` maps canonical paths and types to variable collections, local Figma styles, or an explicit exclusion.

Transformation behavior that is invariant for Avenue—such as canonical extension locations, OKLCH conversion, rem conversion, alias preservation, and artifact identity—is implemented and tested in code rather than repeated as descriptive config.

Both configs use a required `$schemaVersion` and reject unknown fields at every supported level. A stale version or obsolete field fails early instead of being silently ignored. When changing a config contract, update its supported version and add a migration/parity test proving generated output either remains identical or changes intentionally.

The current designer authoring contract is documented in this README and enforced by the compiler. A machine-readable `authoring.schema.json` can be added when the planned token editor needs one; until then, the routing configs should not duplicate authoring-value contracts.

## Commands

Compile YAML into canonical tokens:

```bash
pnpm --filter ave-tokens build:source
```

Build all token outputs:

```bash
pnpm build:tokens
```

Check that generated files are current without writing:

```bash
pnpm --filter ave-tokens check
```

Run tests:

```bash
pnpm --filter ave-tokens test
```

## Published Figma artifact

GitHub Actions validates token changes on relevant pull requests and branch pushes. The CI flow installs only the `ave-tokens` dependency closure, builds `ave-cli`, runs the token tests, checks that the committed `tokens.json` matches the YAML source, and then validates and builds the Figma artifact. Successful runs on `main` publish only `figma-tokens.json` and `manifest.json` to GitHub Pages; pull requests and other branches validate without deploying. A manually dispatched workflow can build any selected ref, but deploys only when run for `main`.

The Pages feed is a public URL. It does not provide authenticated access to private repository contents, and the Figma importer does not support private raw GitHub URLs. Repositories that must keep token artifacts private need a separately authenticated hosting mechanism rather than GitHub Pages or a private `raw.githubusercontent.com` URL.

## Figma importer

The non-destructive Variables and local Styles importer lives in `figma-plugin/`. It creates or updates routed variables and Effect Styles while preserving unmentioned Figma content. Build it with:

```bash
pnpm build:tokens-plugin
```

See `figma-plugin/README.md` for local installation, GitHub Pages source, and plugin ID setup.
