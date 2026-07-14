function parseNumber(input) {
  if (typeof input === "number") {
    return input;
  }

  if (input === null || input === undefined) {
    return NaN;
  }

  const normalized = String(input).trim().replace(/^['"]|['"]$/g, "");
  const numeric = Number.parseFloat(normalized);

  return Number.isFinite(numeric) ? numeric : NaN;
}

function toRem(value, base = 16) {
  const size = parseNumber(value);
  const rootSize = parseNumber(base);

  if (!Number.isFinite(size) || !Number.isFinite(rootSize) || rootSize === 0) {
    return value;
  }

  return `${size / rootSize}rem`;
}

function toEm(value, base = 16) {
  const size = parseNumber(value);
  const context = parseNumber(base);

  if (!Number.isFinite(size) || !Number.isFinite(context) || context === 0) {
    return value;
  }

  return `${size / context}em`;
}

function fluid(minSize, maxSize, minViewport = 320, maxViewport = 1280) {
  const min = parseNumber(minSize);
  const max = parseNumber(maxSize);
  const minVw = parseNumber(minViewport);
  const maxVw = parseNumber(maxViewport);

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(minVw) || !Number.isFinite(maxVw) || maxVw <= minVw) {
    return minSize;
  }

  const slope = ((max - min) / (maxVw - minVw)) * 100;
  const intercept = min - ((max - min) / (maxVw - minVw)) * minVw;

  return `clamp(${toRem(min)}, ${toRem(intercept)} + ${slope.toFixed(4)}vw, ${toRem(max)})`;
}

function spacing(step, base = 0.25) {
  const stepValue = parseNumber(step);
  const baseValue = parseNumber(base);

  if (!Number.isFinite(stepValue) || !Number.isFinite(baseValue)) {
    return step;
  }

  return `${stepValue * baseValue}rem`;
}

const functions = {
  rem: toRem,
  em: toEm,
  fluid,
  space: spacing,
};

export { toRem as rem, toEm as em, fluid, spacing as space };
export default functions;
