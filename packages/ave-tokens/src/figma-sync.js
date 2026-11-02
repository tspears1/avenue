import { planRestSync, verifyRestSync } from "./figma-rest.ts";

const API = "https://api.figma.com/v1/files";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** No automatic POST retries: a lost response may still represent a committed write. */
export async function syncFigma({
  artifact, fileKey, token, apply = false, fetchImpl = fetch,
  onSnapshot = async () => {}, onPlan = async () => {},
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(fileKey ?? "")) throw new Error("FIGMA_FILE_KEY must be a file key, not a URL.");
  if (typeof token !== "string" || !token.trim()) throw new Error("FIGMA_ACCESS_TOKEN is required.");
  const request = async (method, suffix, payload) => {
    let response;
    try {
      response = await fetchImpl(`${API}/${fileKey}/variables${suffix}`, {
        method,
        headers: { "X-Figma-Token": token, ...(payload ? { "Content-Type": "application/json" } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
    } catch {
      throw new Error(`Figma ${method} request failed or timed out.${method === "POST" ? " The write outcome is unknown; rerun a dry run before retrying." : " Check network access and retry."}`);
    }
    if (!response.ok) {
      const hints = {
        400: "Request validation failed; review the saved plan and Figma constraints.",
        401: "Check token validity and expiration.",
        403: "Check Enterprise eligibility, Full seat, token scopes, and file permissions.",
        404: "Check the file key and token access to the file.",
        413: "The request exceeds Figma's payload limit.",
        429: `Rate limited. Retry after ${response.headers.get("retry-after") ?? "the server's requested interval"}.`,
      };
      // Never log raw server responses or request headers, which may contain sensitive data.
      throw new Error(`Figma ${method} returned HTTP ${response.status}. ${hints[response.status] ?? "Check Figma service status and rerun a dry run before retrying."}`);
    }
    let result;
    try { result = await response.json(); } catch { throw new Error(`Figma ${method} returned invalid JSON; rerun a dry run before retrying.`); }
    if (result.error || result.status && result.status !== 200) throw new Error(`Figma ${method} reported an API error; rerun a dry run before retrying.`);
    return result;
  };
  const initial = await request("GET", "/local");
  await onSnapshot(initial);
  const planned = planRestSync(artifact, initial);
  await onPlan(planned);
  if (!apply || planned.plan.operations.length === 0) return { ...planned, applied: false, verified: false };

  // Catch edits between preview and write. Figma has no conditional-write lock,
  // so the source file must still have a single writer during synchronization.
  const current = await request("GET", "/local");
  const refreshed = planRestSync(artifact, current);
  if (stableJson(initial.meta ?? initial) !== stableJson(current.meta ?? current) ||
      stableJson(refreshed.payload) !== stableJson(planned.payload)) {
    throw new Error("Figma changed during planning. No write was sent; rerun to review a fresh plan.");
  }
  await onSnapshot(current);
  await request("POST", "", planned.payload);
  const actual = await request("GET", "/local");
  const verification = verifyRestSync(artifact, actual);
  if (!verification.matches) throw new Error("Figma accepted the write, but read-back verification found remaining changes. Rerun a dry run; do not assume synchronization completed.");
  return { ...planned, applied: true, verified: true };
}
