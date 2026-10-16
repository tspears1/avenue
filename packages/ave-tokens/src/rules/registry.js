import {
  isUnsupportedConversion,
  unsupportedConversion,
} from "./define-unit-rule.js";

function normalizeName(value) {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

function requirementsAreMet(rule, target, context) {
  const requirements = rule.requirements[target] ?? {};
  return Object.entries(requirements).every(([name, predicate]) =>
    predicate(context[name], context),
  );
}

/** Creates a case-insensitive registry from unit-rule plain objects. */
export function createUnitRegistry(rules) {
  if (!Array.isArray(rules)) {
    throw new TypeError("Unit registry rules must be an array.");
  }

  const rulesBySymbol = new Map();
  const symbolsByName = new Map();
  const aliasNames = [];

  for (const rule of rules) {
    if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
      throw new TypeError("Every unit registry entry must be a unit-rule object.");
    }

    const symbol = normalizeName(rule.symbol);
    if (!symbol) {
      throw new TypeError("Every unit registry entry must have a symbol.");
    }

    const names = [symbol, ...(rule.aliases ?? []).map(normalizeName)];
    for (const name of names) {
      if (!name) {
        throw new TypeError(`Unit "${symbol}" contains an invalid alias.`);
      }
      if (symbolsByName.has(name)) {
        throw new Error(
          `Unit name collision for "${name}": "${symbol}" conflicts with "${symbolsByName.get(name)}".`,
        );
      }
      symbolsByName.set(name, symbol);
    }

    rulesBySymbol.set(symbol, rule);
    aliasNames.push(...names.slice(1));
  }

  const allRules = Object.freeze([...rulesBySymbol.values()]);

  function resolveSymbol(name) {
    return symbolsByName.get(normalizeName(name));
  }

  function get(name) {
    const symbol = resolveSymbol(name);
    return symbol === undefined ? undefined : rulesBySymbol.get(symbol);
  }

  function has(name) {
    return resolveSymbol(name) !== undefined;
  }

  function byQuantity(quantity) {
    const normalized = normalizeName(quantity);
    return allRules.filter((rule) => rule.quantity === normalized);
  }

  function byFamily(family) {
    const normalized = normalizeName(family);
    return allRules.filter((rule) => rule.family === normalized);
  }

  function symbols() {
    return [...rulesBySymbol.keys()];
  }

  function aliases() {
    return [...aliasNames];
  }

  function isSupported(name, options = {}) {
    const rule = get(name);
    if (!rule) return false;
    if (options.quantity && rule.quantity !== normalizeName(options.quantity)) return false;
    if (options.family && rule.family !== normalizeName(options.family)) return false;
    if (options.cssSerializable === true && !rule.css.serializable) return false;

    const target = normalizeName(options.conversion ?? options.to);
    if (!target) return true;

    const conversion = rule.conversions[target];
    return (
      conversion !== undefined &&
      !isUnsupportedConversion(conversion) &&
      requirementsAreMet(rule, target, options.context ?? {})
    );
  }

  function supportedUnits(options = {}) {
    return symbols().filter((symbol) => isSupported(symbol, options));
  }

  function convert(value, from, to, context = {}) {
    const rule = get(from);
    if (!rule) return unsupportedConversion(`Unknown source unit "${from}".`);
    if (rule.constraints.finite && !Number.isFinite(value)) {
      return unsupportedConversion(
        `Conversion from "${rule.symbol}" requires a finite numeric value.`,
      );
    }

    const target = normalizeName(to);
    const conversion = rule.conversions[target];
    if (conversion === undefined) {
      return unsupportedConversion(
        `Conversion from "${rule.symbol}" to "${to}" is not defined.`,
      );
    }
    if (isUnsupportedConversion(conversion)) return conversion;
    if (!requirementsAreMet(rule, target, context)) {
      const names = Object.keys(rule.requirements[target] ?? {});
      return unsupportedConversion(
        `Conversion from "${rule.symbol}" to "${target}" requires valid ${names.join(
          ", ",
        )}.`,
      );
    }

    const result = conversion(value, context);
    if (isUnsupportedConversion(result)) return result;
    if (!Number.isFinite(result)) {
      return unsupportedConversion(
        `Conversion from "${rule.symbol}" to "${target}" did not produce a finite number.`,
      );
    }
    return result;
  }

  return Object.freeze({
    get,
    has,
    resolveSymbol,
    byQuantity,
    byFamily,
    symbols,
    aliases,
    isSupported,
    supportedUnits,
    convert,
  });
}
