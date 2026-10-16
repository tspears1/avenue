import { emit, on, showUI } from "@create-figma-plugin/utilities";
import {
  ArtifactValidationError,
  assertValidArtifact,
  planReconciliation,
  reconciliationFingerprint,
  type AvenueFigmaArtifact,
  type ReconciliationPlan,
  type SourcePathIdentityMap,
} from "./core/index.ts";
import {
  PlanApplicationError,
  applyReconciliationPlan,
  assertUnambiguousTargets,
  readFigmaState,
} from "./figma-adapter.ts";
import type {
  AnalysisResultEvent,
  AnalysisSummary,
  AnalyzeEvent,
  CloseEvent,
  ImportEvent,
  ImportResultEvent,
  PendingImport,
  PluginErrorEvent,
  PluginErrorPayload,
  PluginInitialData,
  SourceDescriptor,
} from "./messages.ts";

const SAVED_URL_KEY = "avenue-tokens-url";
const LAST_IMPORTED_KEY = "avenue-tokens-last-imported";

let pendingImport: PendingImport | undefined;
let importInProgress = false;
let nextAnalysisId = 0;
let latestAnalysisId = 0;
let latestRequestId = 0;

function artifactVariableCount(artifact: AvenueFigmaArtifact): number {
  return artifact.collections.reduce(
    (total, collection) => total + collection.variables.length,
    0,
  );
}

function sourceTokenCount(artifact: AvenueFigmaArtifact): number | undefined {
  const value = artifact.summary?.sourceTokens;
  return typeof value === "number" ? value : undefined;
}

function summarize(
  requestId: number,
  analysisId: number,
  artifact: AvenueFigmaArtifact,
  source: SourceDescriptor,
  plan: ReconciliationPlan,
  notice?: string,
): AnalysisSummary {
  return {
    requestId,
    analysisId,
    counts: plan.counts,
    conflicts: plan.conflicts,
    generatedAt: artifact.generatedAt,
    sourceTokens: sourceTokenCount(artifact),
    variables: artifactVariableCount(artifact),
    collections: artifact.collections.length,
    effectStyles: artifact.styles?.effects.length ?? 0,
    source,
    ...(notice ? { notice } : {}),
  };
}

function reportError(error: unknown, context: Partial<PluginErrorPayload> = {}): void {
  if (error instanceof ArtifactValidationError) {
    emit<PluginErrorEvent>("PLUGIN_ERROR", {
      ...context,
      message: error.message,
      details: error.issues.map((issue) => `${issue.path}: ${issue.message}`),
    });
    return;
  }

  emit<PluginErrorEvent>("PLUGIN_ERROR", {
    ...context,
    message: error instanceof Error ? error.message : String(error),
  });
}

function acceptRequest(requestId: number): boolean {
  if (!Number.isSafeInteger(requestId) || requestId <= latestRequestId) {
    reportError(new Error("Ignored a stale or invalid plugin request."), { requestId });
    return false;
  }
  latestRequestId = requestId;
  return true;
}

async function createPlan(artifact: AvenueFigmaArtifact): Promise<{
  plan: ReconciliationPlan;
  identities: SourcePathIdentityMap;
}> {
  const { snapshot, identities } = await readFigmaState();
  assertUnambiguousTargets(artifact, snapshot);
  return {
    plan: planReconciliation(artifact, snapshot, identities),
    identities,
  };
}

function publishPreview(
  requestId: number,
  artifact: AvenueFigmaArtifact,
  source: SourceDescriptor,
  plan: ReconciliationPlan,
  notice?: string,
): number {
  const analysisId = ++nextAnalysisId;
  latestAnalysisId = analysisId;
  pendingImport = {
    analysisId,
    artifact,
    source,
    fingerprint: reconciliationFingerprint(plan),
  };
  emit<AnalysisResultEvent>(
    "ANALYSIS_RESULT",
    summarize(requestId, analysisId, artifact, source, plan, notice),
  );
  return analysisId;
}

async function analyze(request: Parameters<AnalyzeEvent["handler"]>[0]): Promise<void> {
  if (!acceptRequest(request.requestId)) return;
  if (importInProgress) {
    reportError(new Error("Wait for the current import to finish before analyzing another artifact."), {
      requestId: request.requestId,
    });
    return;
  }

  const analysisId = ++nextAnalysisId;
  latestAnalysisId = analysisId;
  try {
    const artifact = assertValidArtifact(request.artifact);
    const { plan } = await createPlan(artifact);
    if (analysisId !== latestAnalysisId) return;

    pendingImport = {
      analysisId,
      artifact,
      source: request.source,
      fingerprint: reconciliationFingerprint(plan),
    };
    emit<AnalysisResultEvent>(
      "ANALYSIS_RESULT",
      summarize(request.requestId, analysisId, artifact, request.source, plan),
    );
  } catch (error) {
    if (analysisId !== latestAnalysisId) return;
    pendingImport = undefined;
    reportError(error, { requestId: request.requestId, analysisId });
  }
}

function failedStepLabel(error: PlanApplicationError): string {
  const step = error.failedOperation;
  if (step.kind === "persistIdentities") return "persist token identities";
  const sourcePath = "sourcePath" in step ? ` for ${step.sourcePath}` : "";
  return `${step.kind}${sourcePath}`;
}

async function reconcileAfterPartial(
  requestId: number,
  artifact: AvenueFigmaArtifact,
  source: SourceDescriptor,
): Promise<number | undefined> {
  try {
    const { plan } = await createPlan(artifact);
    return publishPreview(
      requestId,
      artifact,
      source,
      plan,
      "The document was reread after a partial import. Review the refreshed preview before confirming again.",
    );
  } catch {
    pendingImport = undefined;
    return undefined;
  }
}

async function importPending(request: Parameters<ImportEvent["handler"]>[0]): Promise<void> {
  if (!acceptRequest(request.requestId)) return;
  if (importInProgress) {
    reportError(new Error("An import is already in progress."), {
      requestId: request.requestId,
      analysisId: request.analysisId,
    });
    return;
  }
  importInProgress = true;

  try {
    const pending = pendingImport;
    if (!pending || pending.analysisId !== request.analysisId || request.analysisId !== latestAnalysisId) {
      reportError(new Error("That preview is no longer current. Analyze the artifact again before importing."), {
        requestId: request.requestId,
        analysisId: request.analysisId,
      });
      return;
    }

    const { artifact, source, fingerprint } = pending;
    const { plan, identities } = await createPlan(artifact);
    const replannedFingerprint = reconciliationFingerprint(plan);

    if (replannedFingerprint !== fingerprint) {
      publishPreview(
        request.requestId,
        artifact,
        source,
        plan,
        "The Figma document changed since this preview. Review the refreshed plan and confirm again.",
      );
      return;
    }

    if (plan.conflicts.length > 0) {
      reportError(new Error("Resolve import conflicts before importing."), {
        requestId: request.requestId,
        analysisId: request.analysisId,
      });
      return;
    }

    let plannedChangesApplied: number;
    try {
      plannedChangesApplied = await applyReconciliationPlan(plan, identities);
    } catch (error) {
      if (error instanceof PlanApplicationError) {
        const refreshedAnalysisId = await reconcileAfterPartial(request.requestId, artifact, source);
        reportError(error, {
          requestId: request.requestId,
          analysisId: refreshedAnalysisId ?? request.analysisId,
          partial: error.partial,
          details: [
            `Partial import: ${error.completedOperations} planned changes completed before failure.`,
            `Failed step: ${failedStepLabel(error)}.`,
            refreshedAnalysisId
              ? "The document was reread and the preview now shows the remaining reconciliation."
              : "The document could not be reread automatically; analyze it again before retrying.",
          ],
        });
        return;
      }
      throw error;
    }

    const importedAt = new Date().toISOString();
    const warnings: string[] = [];
    if (source.kind === "url" && source.url) {
      try {
        await figma.clientStorage.setAsync(SAVED_URL_KEY, source.url);
      } catch (error) {
        warnings.push(`Import succeeded, but the source URL could not be saved: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    try {
      await figma.clientStorage.setAsync(LAST_IMPORTED_KEY, importedAt);
    } catch (error) {
      warnings.push(`Import succeeded, but the last-imported time could not be saved: ${error instanceof Error ? error.message : String(error)}`);
    }

    pendingImport = undefined;
    emit<ImportResultEvent>("IMPORT_RESULT", {
      ...summarize(request.requestId, request.analysisId, artifact, source, plan),
      plannedChangesApplied,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    reportError(error, {
      requestId: request.requestId,
      analysisId: request.analysisId,
    });
  } finally {
    importInProgress = false;
  }
}

async function initialize(): Promise<void> {
  const initialData: PluginInitialData = {
    savedUrl: (await figma.clientStorage.getAsync(SAVED_URL_KEY)) ?? "",
    lastImportedAt: await figma.clientStorage.getAsync(LAST_IMPORTED_KEY),
  };

  showUI(
    { height: 640, themeColors: true, width: 420 },
    { ...initialData },
  );
}

export default function runPlugin(): void {
  on<AnalyzeEvent>("ANALYZE", (request) => {
    void analyze(request);
  });
  on<ImportEvent>("IMPORT", (request) => {
    void importPending(request);
  });
  on<CloseEvent>("CLOSE", () => {
    figma.closePlugin();
  });

  void initialize().catch(reportError);
}
