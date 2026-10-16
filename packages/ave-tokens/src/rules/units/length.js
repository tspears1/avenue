import {
  defineUnitRule,
  unsupportedConversion,
} from "../define-unit-rule.js";

const finiteConstraint = Object.freeze({ finite: true });
const serializableCss = Object.freeze({ serializable: true });
const noRequirements = Object.freeze({});

export const px = defineUnitRule({
  symbol: "px",
  aliases: [],
  quantity: "length",
  family: "absolute",
  constraints: finiteConstraint,
  css: serializableCss,
  conversions: { px: (value) => value },
  requirements: noRequirements,
});

export const rem = defineUnitRule({
  symbol: "rem",
  aliases: [],
  quantity: "length",
  family: "font-relative",
  constraints: finiteConstraint,
  css: serializableCss,
  conversions: { px: (value, context) => value * context.rootFontSize },
  requirements: {
    px: {
      rootFontSize: (value) => Number.isFinite(value) && value > 0,
    },
  },
});

export const em = defineUnitRule({
  symbol: "em",
  aliases: [],
  quantity: "length",
  family: "font-relative",
  constraints: finiteConstraint,
  css: serializableCss,
  conversions: {
    px: unsupportedConversion(
      "em to px conversion requires element-specific font-size context and is intentionally unsupported.",
    ),
  },
  requirements: noRequirements,
});

export const ch = defineUnitRule({
  symbol: "ch",
  aliases: [],
  quantity: "length",
  family: "font-relative",
  constraints: finiteConstraint,
  css: serializableCss,
  conversions: {
    px: unsupportedConversion(
      "ch to px conversion depends on font metrics for the rendered zero glyph and is intentionally unsupported.",
    ),
  },
  requirements: noRequirements,
});

export const lengthUnitRules = Object.freeze([px, rem, em, ch]);
