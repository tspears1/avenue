import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ARTIFACT_BYTES,
  assertArtifactSize,
  normalizeArtifactUrl,
} from "../src/source.ts";

test("accepts only credential-free HTTPS hosts allowed by the manifest", () => {
  assert.equal(
    normalizeArtifactUrl("https://design.github.io/tokens.json").hostname,
    "design.github.io",
  );
  assert.equal(
    normalizeArtifactUrl("https://raw.githubusercontent.com/org/repo/main/tokens.json").hostname,
    "raw.githubusercontent.com",
  );
  assert.equal(
    normalizeArtifactUrl("https://github.com/org/repo/blob/main/tokens.json").toString(),
    "https://raw.githubusercontent.com/org/repo/main/tokens.json",
  );

  for (const value of [
    "http://design.github.io/tokens.json",
    "https://user:secret@design.github.io/tokens.json",
    "https://github.io/tokens.json",
    "https://github.com/org/repo/raw/main/tokens.json",
    "https://raw.githubusercontent.com.evil.example/tokens.json",
  ]) {
    assert.throws(() => normalizeArtifactUrl(value), undefined, value);
  }
});

test("enforces the 5 MB artifact limit", () => {
  assert.doesNotThrow(() => assertArtifactSize(MAX_ARTIFACT_BYTES, "File"));
  assert.throws(
    () => assertArtifactSize(MAX_ARTIFACT_BYTES + 1, "File"),
    /5 MB artifact size limit/,
  );
});
