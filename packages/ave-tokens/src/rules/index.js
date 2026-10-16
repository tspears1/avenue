export {
  defineUnitRule,
  unsupportedConversion,
  isUnsupportedConversion,
  isUnsupportedConversionResult,
} from "./define-unit-rule.js";
export { createUnitRegistry } from "./registry.js";
export { parseNumericUnit } from "./parser.js";
export { px, rem, em, ch, lengthUnitRules } from "./units/length.js";
export { ms, s, timeUnitRules } from "./units/time.js";

import { createUnitRegistry } from "./registry.js";
import { lengthUnitRules } from "./units/length.js";
import { timeUnitRules } from "./units/time.js";

export const unitRules = Object.freeze([...lengthUnitRules, ...timeUnitRules]);
export const unitRegistry = createUnitRegistry(unitRules);
export default unitRegistry;
