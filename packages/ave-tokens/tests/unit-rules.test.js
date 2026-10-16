import assert from "node:assert/strict";
import test from "node:test";
import unitRegistry, {
  createUnitRegistry,
  defineUnitRule,
  isUnsupportedConversion,
  parseNumericUnit,
  unitRules,
  unsupportedConversion,
} from "../src/rules/index.js";

function syntheticRule(overrides = {}) {
  return defineUnitRule({
    symbol: "uu",
    aliases: ["units"],
    quantity: "synthetic",
    family: "test",
    constraints: { finite: true },
    css: { serializable: false },
    conversions: { uu: (value) => value },
    requirements: {},
    ...overrides,
  });
}

test("defines immutable plain-object rules and validates true lexical aliases", () => {
  const rule = syntheticRule();

  assert.equal(Object.getPrototypeOf(rule), Object.prototype);
  assert.equal(Object.isFrozen(rule), true);
  assert.deepEqual(rule.aliases, ["units"]);
  assert.throws(
    () => syntheticRule({ aliases: ["UU"] }),
    /not a true alias/,
  );
  assert.throws(
    () => syntheticRule({ aliases: ["not a unit"] }),
    /lexical unit name/,
  );
});

test("registry resolves symbols and aliases without regard to case", () => {
  const registry = createUnitRegistry([syntheticRule()]);

  assert.equal(registry.has("UU"), true);
  assert.equal(registry.has("UNITS"), true);
  assert.equal(registry.resolveSymbol("Units"), "uu");
  assert.equal(registry.get("UNITS").symbol, "uu");
  assert.deepEqual(registry.symbols(), ["uu"]);
  assert.deepEqual(registry.aliases(), ["units"]);
  assert.deepEqual(registry.byQuantity("SYNTHETIC"), [registry.get("uu")]);
  assert.deepEqual(registry.byFamily("TEST"), [registry.get("uu")]);
});

test("registry detects duplicate symbols, aliases, and cross-name collisions", () => {
  const first = syntheticRule();

  assert.throws(
    () => createUnitRegistry([first, syntheticRule({ aliases: ["other"] })]),
    /collision.*uu/i,
  );
  assert.throws(
    () =>
      createUnitRegistry([
        first,
        syntheticRule({ symbol: "other", aliases: ["units-two", "uu"] }),
      ]),
    /collision.*uu/i,
  );
  assert.throws(
    () =>
      createUnitRegistry([
        first,
        syntheticRule({ symbol: "units", aliases: ["units-two"] }),
      ]),
    /collision.*units/i,
  );
});

test("parser handles signed decimals and canonicalizes synthetic aliases", () => {
  const registry = createUnitRegistry([syntheticRule()]);

  assert.deepEqual(
    parseNumericUnit(" -1.25UNITS ", {
      registry,
      expectedQuantity: "synthetic",
    }),
    { value: -1.25, unit: "uu" },
  );
  assert.deepEqual(parseNumericUnit("+.5uu", registry, "synthetic"), {
    value: 0.5,
    unit: "uu",
  });
  assert.deepEqual(parseNumericUnit("2.uu", { registry }), {
    value: 2,
    unit: "uu",
  });
});

test("parser reports malformed, unknown, and quantity-mismatched values", () => {
  assert.throws(
    () => parseNumericUnit("1 rem", { registry: unitRegistry }),
    /Invalid numeric unit value/,
  );
  assert.throws(
    () => parseNumericUnit("1fortnight", { registry: unitRegistry }),
    /Unknown unit suffix "fortnight"/,
  );
  assert.throws(
    () =>
      parseNumericUnit("250ms", {
        registry: unitRegistry,
        expectedQuantity: "length",
      }),
    /quantity "time".*"length" was expected/,
  );
});

test("current unit conversions return numeric or explicit unsupported outcomes", () => {
  assert.equal(unitRegistry.convert(12, "px", "px"), 12);
  assert.equal(unitRegistry.convert(1.5, "rem", "px", { rootFontSize: 16 }), 24);
  assert.equal(unitRegistry.convert(125, "ms", "ms"), 125);
  assert.equal(unitRegistry.convert(1.25, "s", "ms"), 1250);

  const missingRootSize = unitRegistry.convert(1, "rem", "px");
  assert.equal(isUnsupportedConversion(missingRootSize), true);
  assert.match(missingRootSize.reason, /rootFontSize/);

  for (const rootFontSize of [0, -16, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.equal(
      isUnsupportedConversion(
        unitRegistry.convert(1, "rem", "px", { rootFontSize }),
      ),
      true,
    );
  }

  for (const symbol of ["em", "ch"]) {
    const result = unitRegistry.convert(1, symbol, "px");
    assert.equal(isUnsupportedConversion(result), true);
    assert.match(result.reason, /intentionally unsupported/);
  }
});

test("unsupported conversion helper produces recognizable results", () => {
  const result = unsupportedConversion("Synthetic reason.");

  assert.deepEqual(result, { supported: false, reason: "Synthetic reason." });
  assert.equal(isUnsupportedConversion(result), true);
  assert.equal(isUnsupportedConversion(10), false);
});

test("registry reports supported units dynamically for context and target", () => {
  assert.deepEqual(unitRegistry.supportedUnits({ conversion: "px" }), ["px"]);
  assert.deepEqual(
    unitRegistry.supportedUnits({ conversion: "px", context: { rootFontSize: 16 } }),
    ["px", "rem"],
  );
  assert.deepEqual(unitRegistry.supportedUnits({ conversion: "ms" }), ["ms", "s"]);
  assert.deepEqual(unitRegistry.supportedUnits({ quantity: "time" }), ["ms", "s"]);
});

test("all current rules satisfy the shared unit-rule contract", () => {
  assert.deepEqual(unitRegistry.symbols(), ["px", "rem", "em", "ch", "ms", "s"]);
  assert.equal(unitRules.length, unitRegistry.symbols().length);

  for (const rule of unitRules) {
    assert.equal(Object.getPrototypeOf(rule), Object.prototype);
    assert.equal(Object.isFrozen(rule), true);
    assert.match(rule.symbol, /^[a-z][a-z0-9-]*$/);
    assert.equal(Array.isArray(rule.aliases), true);
    assert.equal(typeof rule.quantity, "string");
    assert.equal(rule.constraints.finite, true);
    assert.equal(typeof rule.css.serializable, "boolean");
    assert.equal(Object.getPrototypeOf(rule.conversions), Object.prototype);
    assert.equal(Object.getPrototypeOf(rule.requirements), Object.prototype);
    assert.equal(unitRegistry.get(rule.symbol), rule);
  }
});
