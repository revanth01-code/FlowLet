// ─── Step union ──────────────────────────────────────────────────────────────

export type FilterOperator = "eq" | "neq" | "gt" | "lt" | "contains";

export interface FilterStep {
  type: "filter";
  field: string;
  operator: FilterOperator;
  value: unknown; // the backend accepts any JSON value here
}

export interface TransformStep {
  type: "transform";
  mapping: Record<string, string>; // output field -> dot path
}

export interface HttpRequestStep {
  type: "http_request";
  url: string;
  method: "POST" | "PUT";
}

export type Step = FilterStep | TransformStep | HttpRequestStep;

// ─── Flow ─────────────────────────────────────────────────────────────────────

/** Returned by GET /api/flows (list). No steps, no secret. */
export interface FlowSummary {
  _id: string;
  name: string;
  enabled: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Returned by GET /api/flows/:id, POST /api/flows, PATCH /api/flows/:id. */
export interface Flow extends FlowSummary {
  description?: string;
  steps: Step[];
  webhookSecret: string;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

export type RunStatus = "success" | "filtered" | "failed";
export type StepStatus = "success" | "failed" | "skipped";

export interface RunSummary {
  id: string; // UUID
  flowId: string;
  status: RunStatus;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  durationMs: number;
  errorMessage: string | null;
}

export interface RunStepDetail {
  position: number;
  type: "filter" | "transform" | "http_request";
  status: StepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number;
}

export interface RunDetail extends RunSummary {
  payload: unknown; // raw incoming event body
  steps: RunStepDetail[];
}

// ─── Paginated run list ───────────────────────────────────────────────────────

export interface RunListPage {
  items: RunSummary[];
  nextCursor: string | null;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface FlowStats {
  total: number;
  success: number;
  failed: number;
  filtered: number;
  avgDurationMs: number | null; // null when total === 0 (no runs yet)
  lastRunAt: string | null; // ISO or null if no runs yet
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  code: string; // e.g. "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED", "CONFLICT"
  message: string;
  details: Record<string, unknown>;
}

export interface ErrorResponse {
  error: ApiErrorBody;
}

// ─── Webhook trigger result ───────────────────────────────────────────────────

export interface TriggerResult {
  runId: string;
  status: RunStatus;
}
