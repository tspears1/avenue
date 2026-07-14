# ave-css

Shared CSS foundation package for Avenue themes, Storybook, and UI packages.

## Import plan

- `ave-css/styles` or `ave-css/styles/core`: variables + utilities
- `ave-css/styles/layers`: shared cascade layer order only
- `ave-css/styles/breakpoints`: shared custom media breakpoints
- `ave-css/styles/variables`: variables only
- `ave-css/styles/utils`: utility classes only
- `ave-css/mixins`: shared PostCSS mixins
- `ave-css/functions`: shared PostCSS functions map
- `ave-css/postcss`: default shared PostCSS config

## CSS usage

```css
@import "ave-css/styles";
```

```css
@import "ave-css/styles/layers";
@import "ave-css/styles/breakpoints";
```

```css
@import "ave-css/styles/variables";
@import "ave-css/styles/utils";
```

## Mixins usage

```css
@import "ave-css/mixins";

.card-list {
  @mixin stack var(--ave-space-5);
}
```

## PostCSS config usage

```js
import { createPostcssConfig } from "ave-css/postcss";

export default createPostcssConfig({
  additionalFunctions: {
    px: (value) => `${value}px`,
  },
});
```

## Supported authoring features

- Mixins via `postcss-mixins`
- Functions via `postcss-functions`
- SCSS-like variables, conditionals, and loops via `postcss-advanced-variables`
- SCSS parser compatibility via `postcss-scss` for interpolation-heavy migration paths
