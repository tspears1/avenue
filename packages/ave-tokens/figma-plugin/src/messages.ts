import type {
  AvenueFigmaArtifact,
  ReconciliationConflict,
  ReconciliationCounts,
} from "./core/index.ts";

export interface SourceDescriptor {
  kind: "url" | "file";
  label: string;
  url?: string;
}

export interface AnalyzeRequest {
  requestId: number;
  artifact: unknown;
  source: SourceDescriptor;
}

export interface AnalysisSummary {
  requestId: number;
  analysisId: number;
  counts: ReconciliationCounts;
  conflicts: ReconciliationConflict[];
  generatedAt?: string;
  sourceTokens?: number;
  variables: number;
  collections: number;
  effectStyles: number;
  source: SourceDescriptor;
  notice?: string;
}

export interface ImportSummary extends AnalysisSummary {
  plannedChangesApplied: number;
  warnings?: string[];
}

export interface PluginErrorPayload {
  requestId?: number;
  analysisId?: number;
  message: string;
  details?: string[];
  partial?: boolean;
}

export interface AnalyzeEvent {
  name: "ANALYZE";
  handler: (request: AnalyzeRequest) => void;
}

export interface AnalysisResultEvent {
  name: "ANALYSIS_RESULT";
  handler: (summary: AnalysisSummary) => void;
}

export interface ImportRequest {
  requestId: number;
  analysisId: number;
}

export interface ImportEvent {
  name: "IMPORT";
  handler: (request: ImportRequest) => void;
}

export interface ImportResultEvent {
  name: "IMPORT_RESULT";
  handler: (summary: ImportSummary) => void;
}

export interface PluginErrorEvent {
  name: "PLUGIN_ERROR";
  handler: (error: PluginErrorPayload) => void;
}

export interface CloseEvent {
  name: "CLOSE";
  handler: () => void;
}

export interface PluginInitialData {
  savedUrl: string;
  lastImportedAt?: string;
}

export interface PendingImport {
  analysisId: number;
  artifact: AvenueFigmaArtifact;
  source: SourceDescriptor;
  fingerprint: string;
}
