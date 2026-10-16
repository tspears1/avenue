import {
  Banner,
  Button,
  Container,
  FileUploadButton,
  IconCheck16,
  IconInfo16,
  IconWarning16,
  Tabs,
  Text,
  Textbox,
  VerticalSpace,
  render,
} from "@create-figma-plugin/ui";
import { emit, on } from "@create-figma-plugin/utilities";
import { useEffect, useRef, useState } from "preact/hooks";
import type {
  AnalysisResultEvent,
  AnalysisSummary,
  AnalyzeEvent,
  CloseEvent,
  ImportEvent,
  ImportResultEvent,
  ImportSummary,
  PluginErrorEvent,
  PluginInitialData,
  SourceDescriptor,
} from "./messages.ts";
import {
  assertArtifactSize,
  normalizeArtifactUrl,
  responseContentLength,
  utf8ByteLength,
} from "./source.ts";
import "./ui.css";

type Step = "source" | "preview" | "done";
type SourceType = "url" | "file";


function cacheBustedUrl(value: string): string {
  const url = new URL(value);
  url.searchParams.set("ave-tokens-cache", Date.now().toString());
  return url.toString();
}

function formatDate(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function countTotal(summary: AnalysisSummary, entity: keyof AnalysisSummary["counts"]): number {
  const count = summary.counts[entity];
  return count.create + count.update + count.unchanged + count.conflict;
}

function SummaryTable({ summary }: { summary: AnalysisSummary }) {
  return (
    <div class="summary">
      <div class="summary-row summary-labels">
        <span />
        <span class="summary-number">Add</span>
        <span class="summary-number">Update</span>
        <span class="summary-number">Same</span>
        <span class="summary-number">Issues</span>
      </div>
      {(["collections", "modes", "variables", "effectStyles"] as const).map((entity) => {
        const count = summary.counts[entity];
        return (
          <div class="summary-row" key={entity}>
            <strong>{entity === "effectStyles" ? "Effect styles" : entity[0].toUpperCase() + entity.slice(1)}</strong>
            <span class="summary-number">{count.create}</span>
            <span class="summary-number">{count.update}</span>
            <span class="summary-number">{count.unchanged}</span>
            <span class="summary-number">{count.conflict}</span>
          </div>
        );
      })}
    </div>
  );
}

function Plugin(initialData: PluginInitialData) {
  const [step, setStep] = useState<Step>("source");
  const [sourceType, setSourceType] = useState<SourceType>("url");
  const [url, setUrl] = useState(initialData.savedUrl);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] }>();
  const [analysis, setAnalysis] = useState<AnalysisSummary>();
  const [result, setResult] = useState<ImportSummary>();
  const nextRequestId = useRef(0);
  const activeRequestId = useRef(0);
  const activeFetch = useRef<AbortController>();

  const beginRequest = (): number => {
    const requestId = ++nextRequestId.current;
    activeRequestId.current = requestId;
    return requestId;
  };

  useEffect(() => {
    const disposeAnalysis = on<AnalysisResultEvent>("ANALYSIS_RESULT", (summary) => {
      if (summary.requestId !== activeRequestId.current) return;
      setLoading(false);
      setError(undefined);
      setAnalysis(summary);
      setStep("preview");
    });
    const disposeResult = on<ImportResultEvent>("IMPORT_RESULT", (summary) => {
      if (summary.requestId !== activeRequestId.current) return;
      setLoading(false);
      setError(undefined);
      setResult(summary);
      setStep("done");
    });
    const disposeError = on<PluginErrorEvent>("PLUGIN_ERROR", (payload) => {
      if (payload.requestId !== undefined && payload.requestId !== activeRequestId.current) return;
      setLoading(false);
      setError(payload);
    });

    return () => {
      activeFetch.current?.abort();
      disposeAnalysis();
      disposeResult();
      disposeError();
    };
  }, []);

  const analyzeArtifact = (
    requestId: number,
    artifact: unknown,
    source: SourceDescriptor,
  ) => {
    if (requestId !== activeRequestId.current) return;
    setLoading(true);
    setError(undefined);
    emit<AnalyzeEvent>("ANALYZE", { requestId, artifact, source });
  };

  const analyzeUrl = async () => {
    activeFetch.current?.abort();
    const controller = new AbortController();
    activeFetch.current = controller;
    const requestId = beginRequest();
    try {
      setLoading(true);
      setError(undefined);
      const normalized = normalizeArtifactUrl(url);
      const response = await fetch(cacheBustedUrl(normalized.toString()), {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Unable to load tokens (${response.status} ${response.statusText}).`);
      }
      const contentLength = responseContentLength(response);
      if (contentLength !== undefined) assertArtifactSize(contentLength, "Response");
      const text = await response.text();
      assertArtifactSize(utf8ByteLength(text), "Response");
      if (controller.signal.aborted || requestId !== activeRequestId.current) return;

      analyzeArtifact(requestId, JSON.parse(text), {
        kind: "url",
        label: normalized.toString(),
        url: normalized.toString(),
      });
    } catch (caught) {
      if (controller.signal.aborted || requestId !== activeRequestId.current) return;
      setLoading(false);
      setError({
        message: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      if (activeFetch.current === controller) activeFetch.current = undefined;
    }
  };

  const analyzeFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    activeFetch.current?.abort();
    const requestId = beginRequest();
    try {
      setFileName(file.name);
      setLoading(true);
      setError(undefined);
      assertArtifactSize(file.size, "File");
      const text = await file.text();
      assertArtifactSize(utf8ByteLength(text), "File");
      analyzeArtifact(requestId, JSON.parse(text), {
        kind: "file",
        label: file.name,
      });
    } catch (caught) {
      if (requestId !== activeRequestId.current) return;
      setLoading(false);
      setError({
        message: caught instanceof Error ? caught.message : String(caught),
      });
    }
  };

  const importTokens = () => {
    if (!analysis) return;
    const requestId = beginRequest();
    setLoading(true);
    setError(undefined);
    emit<ImportEvent>("IMPORT", { requestId, analysisId: analysis.analysisId });
  };

  return (
    <div class="plugin">
      <header class="header">
        <h1>Avenue Tokens</h1>
        <p>Import generated tokens into local Figma variables and effect styles.</p>
      </header>

      <main class="content">
        {error && (
          <Container space="medium">
            <Banner icon={<IconWarning16 />} variant="warning">
              <Text>{error.message}</Text>
              {error.details?.map((detail) => <Text key={detail}>{detail}</Text>)}
            </Banner>
          </Container>
        )}

        {step === "source" && (
          <div class="source-panel">
            <Tabs
              onValueChange={(value) => setSourceType(value as SourceType)}
              options={[
                { children: "URL", value: "url" },
                { children: "File", value: "file" },
              ]}
              value={sourceType}
            />
            <VerticalSpace space="large" />

            {sourceType === "url" ? (
              <>
                <label class="field-label" for="token-url">Token artifact URL</label>
                <Textbox
                  id="token-url"
                  onValueInput={setUrl}
                  placeholder="https://your-org.github.io/repo/figma-tokens.json"
                  value={url}
                />
                <VerticalSpace space="medium" />
                <Button
                  disabled={url.trim().length === 0}
                  fullWidth
                  loading={loading}
                  onClick={() => void analyzeUrl()}
                >
                  Analyze
                </Button>
                <Text class="muted">
                  GitHub Pages, raw GitHub URLs, and normal GitHub file URLs are supported.
                </Text>
              </>
            ) : (
              <>
                <FileUploadButton
                  acceptedFileTypes={["application/json", ".json"]}
                  fullWidth
                  loading={loading}
                  onSelectedFiles={(files) => void analyzeFile(files)}
                  secondary
                >
                  Choose figma-tokens.json
                </FileUploadButton>
                {fileName && <div class="file-name">{fileName}</div>}
              </>
            )}

            {initialData.lastImportedAt && (
              <div class="last-import">
                Last import: {formatDate(initialData.lastImportedAt)}
              </div>
            )}
          </div>
        )}

        {step === "preview" && analysis && (
          <div class="preview-panel">
            <h2 class="section-title">Import preview</h2>
            <div class="meta">
              <div class="meta-row"><span>Source</span><span title={analysis.source.label}>{analysis.source.label}</span></div>
              <div class="meta-row"><span>Generated</span><span>{formatDate(analysis.generatedAt)}</span></div>
              <div class="meta-row"><span>Collections</span><span>{analysis.collections}</span></div>
              <div class="meta-row"><span>Variables</span><span>{analysis.variables}</span></div>
              <div class="meta-row"><span>Effect styles</span><span>{analysis.effectStyles}</span></div>
              {analysis.sourceTokens !== undefined && (
                <div class="meta-row"><span>Source tokens</span><span>{analysis.sourceTokens}</span></div>
              )}
            </div>
            <SummaryTable summary={analysis} />

            {analysis.notice && (
              <Banner icon={<IconInfo16 />}>
                <Text>{analysis.notice}</Text>
              </Banner>
            )}

            {analysis.conflicts.length > 0 ? (
              <Banner icon={<IconWarning16 />} variant="warning">
                <Text>Resolve these conflicts in Figma before importing.</Text>
                <ul class="conflicts">
                  {analysis.conflicts.map((conflict) => (
                    <li key={`${conflict.sourcePath}-${conflict.reason}`}>
                      {conflict.message}
                    </li>
                  ))}
                </ul>
              </Banner>
            ) : (
              <Banner icon={<IconInfo16 />}>
                <Text>
                  Nothing will be deleted. Variables, modes, and styles not listed in the artifact are preserved.
                </Text>
              </Banner>
            )}
          </div>
        )}

        {step === "done" && result && (
          <div class="result-panel">
            <div class="success-mark"><IconCheck16 /></div>
            <h2 class="section-title">Import complete</h2>
            <Text>{result.plannedChangesApplied} planned changes applied.</Text>
            <SummaryTable summary={result} />
            {result.warnings && result.warnings.length > 0 && (
              <Banner icon={<IconWarning16 />} variant="warning">
                <Text>The document import succeeded with storage warnings:</Text>
                {result.warnings.map((warning) => <Text key={warning}>{warning}</Text>)}
              </Banner>
            )}
          </div>
        )}
      </main>

      {step === "preview" && analysis && (
        <footer class="footer-actions">
          <Button disabled={loading} onClick={() => setStep("source")} secondary>
            Back
          </Button>
          <Button
            disabled={analysis.conflicts.length > 0}
            loading={loading}
            onClick={importTokens}
          >
            Import
          </Button>
        </footer>
      )}

      {step === "done" && (
        <footer class="footer-actions">
          <Button fullWidth onClick={() => emit<CloseEvent>("CLOSE")}>
            Done
          </Button>
        </footer>
      )}
    </div>
  );
}

export default render(Plugin);
