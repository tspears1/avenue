import { defineUnitRule } from "../define-unit-rule.js";

const finiteConstraint = Object.freeze({ finite: true });
const serializableCss = Object.freeze({ serializable: true });
const noRequirements = Object.freeze({});

export const ms = defineUnitRule({
  symbol: "ms",
  aliases: [],
  quantity: "time",
  family: "duration",
  constraints: finiteConstraint,
  css: serializableCss,
  conversions: { ms: (value) => value },
  requirements: noRequirements,
});

export const s = defineUnitRule({
  symbol: "s",
  aliases: [],
  quantity: "time",
  family: "duration",
  constraints: finiteConstraint,
  css: serializableCss,
  conversions: { ms: (value) => value * 1000 },
  requirements: noRequirements,
});

export const timeUnitRules = Object.freeze([ms, s]);
