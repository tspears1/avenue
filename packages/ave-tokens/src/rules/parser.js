const NUMERIC_UNIT_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))([a-z][a-z0-9-]*)$/i;

function isRegistry(value) {
  return value && typeof value.get === "function" && typeof value.resolveSymbol === "function";
}

/**
 * Parses a signed decimal and registered unit suffix.
 *
 * Options: `{ registry, expectedQuantity }`. A registry may also be supplied
 * directly as the second argument, with expected quantity as the third.
 */
export function parseNumericUnit(input, options, expectedQuantityArgument) {
  const registry = isRegistry(options) ? options : options?.registry;
  const expectedQuantity = isRegistry(options)
    ? expectedQuantityArgument
    : options?.expectedQuantity ?? options?.quantity;

  if (!isRegistry(registry)) {
    throw new TypeError("parseNumericUnit requires a unit registry.");
  }
  if (typeof input !== "string") {
    throw new TypeError("A numeric unit value must be a string.");
  }

  const source = input.trim();
  const match = NUMERIC_UNIT_PATTERN.exec(source);
  if (!match) {
    throw new SyntaxError(
      `Invalid numeric unit value ${JSON.stringify(input)}; expected a signed decimal followed by a registered unit suffix.`,
    );
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    throw new RangeError(`Numeric value in ${JSON.stringify(input)} must be finite.`);
  }

  const suppliedUnit = match[2];
  const unit = registry.resolveSymbol(suppliedUnit);
  if (unit === undefined) {
    throw new RangeError(`Unknown unit suffix "${suppliedUnit}" in ${JSON.stringify(input)}.`);
  }

  const rule = registry.get(unit);
  if (
    expectedQuantity !== undefined &&
    rule.quantity !== String(expectedQuantity).toLowerCase()
  ) {
    throw new TypeError(
      `Unit "${suppliedUnit}" has quantity "${rule.quantity}", but "${expectedQuantity}" was expected.`,
    );
  }

  return { value, unit };
}
