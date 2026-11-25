/**
 * Typed fetch wrapper for the Flowlet backend.
 *
 * Base URL is read once from NEXT_PUBLIC_API_URL so it is never hardcoded in
 * more than one place.  Every function either returns the typed success shape
 * or throws an ApiError so callers can handle errors uniformly.
 */

import type {
  Flow,
  FlowSummary,
  FlowStats,
  RunDetail,
  RunListPage,
  RunStatus,
  ErrorResponse,
} from "./types";

// ─── Base URL (single source of truth) ───────────────────────────────────────

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Error class ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: ErrorResponse,
  ) {
    super(body.error.message);
    this.name = "ApiError";
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  // 204 No Content — return undefined cast as T (only DELETE uses this)
  if (res.status === 204) {
    return undefined as T;
  }

  // Parse JSON regardless of status so we can read the error shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any; // `any` needed: response may be success shape OR error shape
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, {
      error: {
        code: "PARSE_ERROR",
        message: `HTTP ${res.status}: response was not valid JSON`,
        details: {},
      },
    });
  }

  if (!res.ok) {
    // Backend always returns { error: { code, message, details } } for 4xx/5xx
    const errBody = json as ErrorResponse;
    throw new ApiError(res.status, errBody);
  }

  return json as T;
}

// ─── Flows ────────────────────────────────────────────────────────────────────

/** GET /api/flows — returns FlowSummary[] directly (not wrapped). */
export async function listFlows(): Promise<FlowSummary[]> {
  return request<FlowSummary[]>("/api/flows");
}

/** GET /api/flows/:id */
export async function getFlow(id: string): Promise<Flow> {
  return request<Flow>(`/api/flows/${id}`);
}

export interface CreateFlowInput {
  name: string;
  description?: string;
  enabled?: boolean;
  steps: Flow["steps"];
}

/** POST /api/flows — returns 201 + full Flow (with webhookSecret). */
export async function createFlow(input: CreateFlowInput): Promise<Flow> {
  return request<Flow>("/api/flows", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateFlowInput = Partial<CreateFlowInput>;

/** PATCH /api/flows/:id — partial update. Returns updated Flow. */
export async function updateFlow(
  id: string,
  input: UpdateFlowInput,
): Promise<Flow> {
  return request<Flow>(`/api/flows/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** DELETE /api/flows/:id — returns 204, no body. */
export async function deleteFlow(id: string): Promise<void> {
  return request<void>(`/api/flows/${id}`, { method: "DELETE" });
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export interface ListRunsOptions {
  status?: RunStatus;
  limit?: number;
  cursor?: string;
}

/** GET /api/flows/:id/runs — returns { items, nextCursor }. */
export async function listRuns(
  flowId: string,
  opts: ListRunsOptions = {},
): Promise<RunListPage> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  return request<RunListPage>(`/api/flows/${flowId}/runs${qs}`);
}

/** GET /api/runs/:runId — full RunDetail with step breakdown. */
export async function getRun(runId: string): Promise<RunDetail> {
  return request<RunDetail>(`/api/runs/${runId}`);
}

/** GET /api/flows/:id/stats */
export async function getFlowStats(flowId: string): Promise<FlowStats> {
  return request<FlowStats>(`/api/flows/${flowId}/stats`);
}
