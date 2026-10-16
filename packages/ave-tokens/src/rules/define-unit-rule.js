const LEXICAL_UNIT = /^[a-z][a-z0-9-]*$/i;

function assertPlainObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function assertLexicalUnit(value, label) {
  if (typeof value !== "string" || !LEXICAL_UNIT.test(value)) {
    throw new TypeError(
      `${label} must be a lexical unit name containing only letters, digits, and hyphens, beginning with a letter.`,
    );
  }
}

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

/**
 * Defines and validates an immutable, plain-object unit rule.
 */
export function defineUnitRule(definition) {
  assertPlainObject(definition, "Unit rule");

  const {
    symbol,
    aliases = [],
    quantity,
    family,
    constraints,
    css,
    conversions = {},
    requirements = {},
  } = definition;

  assertLexicalUnit(symbol, "Unit rule symbol");

  if (!Array.isArray(aliases)) {
    throw new TypeError(`Aliases for unit "${symbol}" must be an array.`);
  }

  const normalizedSymbol = symbol.toLowerCase();
  const seenAliases = new Set();
  const normalizedAliases = aliases.map((alias, index) => {
    assertLexicalUnit(alias, `Alias ${index} for unit "${symbol}"`);
    const normalizedAlias = alias.toLowerCase();

    if (normalizedAlias === normalizedSymbol) {
      throw new Error(
        `Alias "${alias}" for unit "${symbol}" is not a true alias; it is the symbol itself.`,
      );
    }
    if (seenAliases.has(normalizedAlias)) {
      throw new Error(`Duplicate alias "${alias}" for unit "${symbol}".`);
    }

    seenAliases.add(normalizedAlias);
    return normalizedAlias;
  });

  if (typeof quantity !== "string" || quantity.length === 0) {
    throw new TypeError(`Quantity for unit "${symbol}" must be a non-empty string.`);
  }
  if (family !== undefined && (typeof family !== "string" || family.length === 0)) {
    throw new TypeError(`Family for unit "${symbol}" must be a non-empty string when provided.`);
  }

  assertPlainObject(constraints, `Constraints for unit "${symbol}"`);
  if (constraints.finite !== true) {
    throw new Error(`Unit "${symbol}" must require finite numeric values.`);
  }

  assertPlainObject(css, `CSS metadata for unit "${symbol}"`);
  if (typeof css.serializable !== "boolean") {
    throw new TypeError(`css.serializable for unit "${symbol}" must be boolean.`);
  }

  assertPlainObject(conversions, `Conversions for unit "${symbol}"`);
  for (const [target, conversion] of Object.entries(conversions)) {
    assertLexicalUnit(target, `Conversion target for unit "${symbol}"`);
    if (typeof conversion !== "function" && !isUnsupportedConversion(conversion)) {
      throw new TypeError(
        `Conversion from "${symbol}" to "${target}" must be a function or an unsupported conversion result.`,
      );
    }
  }

  assertPlainObject(requirements, `Requirements for unit "${symbol}"`);
  for (const [target, targetRequirements] of Object.entries(requirements)) {
    if (!Object.hasOwn(conversions, target)) {
      throw new Error(
        `Requirements for unit "${symbol}" reference missing conversion target "${target}".`,
      );
    }
    assertPlainObject(
      targetRequirements,
      `Requirements for conversion from "${symbol}" to "${target}"`,
    );
    for (const [name, predicate] of Object.entries(targetRequirements)) {
      if (typeof predicate !== "function") {
        throw new TypeError(
          `Requirement "${name}" for conversion from "${symbol}" to "${target}" must be a predicate function.`,
        );
      }
    }
  }

  const frozenRequirements = Object.fromEntries(
    Object.entries(requirements).map(([target, targetRequirements]) => [
      target.toLowerCase(),
      freezeRecord(targetRequirements),
    ]),
  );

  return Object.freeze({
    symbol: normalizedSymbol,
    aliases: Object.freeze(normalizedAliases),
    quantity: quantity.toLowerCase(),
    ...(family === undefined ? {} : { family: family.toLowerCase() }),
    constraints: freezeRecord(constraints),
    css: freezeRecord(css),
    conversions: freezeRecord(
      Object.fromEntries(
        Object.entries(conversions).map(([target, conversion]) => [
          target.toLowerCase(),
          conversion,
        ]),
      ),
    ),
    requirements: freezeRecord(frozenRequirements),
  });
}

/** Returns a stable result for a conversion that cannot be performed. */
export function unsupportedConversion(reason) {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new TypeError("An unsupported conversion requires a non-empty reason.");
  }

  return Object.freeze({ supported: false, reason });
}

/** Identifies results created for unsupported conversions. */
export function isUnsupportedConversion(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.supported === false &&
    typeof value.reason === "string"
  );
}

export const isUnsupportedConversionResult = isUnsupportedConversion;
