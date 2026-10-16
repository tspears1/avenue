export const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

const GITHUB_BLOB_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;

export function normalizeArtifactUrl(input: string): URL {
  const value = input.trim();
  const github = GITHUB_BLOB_PATTERN.exec(value);
  const normalized = github
    ? `https://raw.githubusercontent.com/${github[1]}/${github[2]}/${github[3]}/${github[4]}`
    : value;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Enter a valid artifact URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Artifact URLs must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Artifact URLs must not include credentials.");
  }

  const allowedHost =
    url.hostname === "raw.githubusercontent.com" ||
    /^(?:[^.]+\.)+github\.io$/i.test(url.hostname);
  if (!allowedHost) {
    throw new Error("Artifact URL host is not allowed by the plugin manifest.");
  }

  return url;
}

export function assertArtifactSize(size: number, source: string): void {
  if (!Number.isFinite(size) || size < 0) {
    throw new Error(`Unable to determine ${source} size.`);
  }
  if (size > MAX_ARTIFACT_BYTES) {
    throw new Error(`${source} exceeds the 5 MB artifact size limit.`);
  }
}

export function responseContentLength(response: Response): number | undefined {
  const value = response.headers.get("content-length");
  if (value === null) return undefined;
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : undefined;
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
