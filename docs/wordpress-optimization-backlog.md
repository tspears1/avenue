# WordPress Optimization Backlog

Deferred after the behavior-preserving cleanup of
`packages/ave-ui/src/WordPress`.

## Opportunities

1. Move the large inline diagnostics script out of `AdminPage.php` and into a
   dedicated JavaScript module.

2. Consider separating `ComponentSchema` into schema-definition validation and
   runtime value parsing if the class continues to grow.

3. Cache normalized ACF required-field metadata for the duration of each
   request.

4. Allow adapter registration to accept a provider map once enough adapters
   exist to justify the abstraction. Keep the current explicit registration
   while only a small number of adapters exist.

## Completed

- Normalized the source layout to `Core` and `WordPress`, including the
  `ACF`, `Adapters`, `GUI`, and `Utils` namespace directories. Composer's
  strict PSR validation, the Git index, and Loom's package autoloader verify
  the exact casing.

## Guardrails

- Preserve the current schema-driven `data-props` behavior.
- Keep component-specific transformations inside components or adapters.
- Keep shared rendering and ACF infrastructure component-agnostic.
- Add focused regression coverage before changing bootstrap, autoloading, or
  registration behavior.
