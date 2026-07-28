# WordPress Optimization Backlog

Deferred after the behavior-preserving cleanup of
`packages/ave-ui/src/wordpress`.

## Opportunities

1. Move the large inline diagnostics script out of `AdminPage.php` and into a
   dedicated JavaScript module.

2. Consider separating `ComponentSchema` into schema-definition validation and
   runtime value parsing if the class continues to grow.

3. Cache normalized ACF required-field metadata for the duration of each
   request.

4. Normalize the lowercase `wordpress` directory structure and
   `AvenueUI\WordPress` namespace casing in a dedicated PSR-4 migration. Treat
   this as an autoload-sensitive change and verify it on a case-sensitive
   filesystem.

5. Allow adapter registration to accept a provider map once enough adapters
   exist to justify the abstraction. Keep the current explicit registration
   while only a small number of adapters exist.

## Guardrails

- Preserve the current schema-driven `data-props` behavior.
- Keep component-specific transformations inside components or adapters.
- Keep shared rendering and ACF infrastructure component-agnostic.
- Add focused regression coverage before changing bootstrap, autoloading, or
  registration behavior.
