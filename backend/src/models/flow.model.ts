// Working on: Flow + Step TypeScript types — the shape stored in MongoDB.
// These are the single source of truth for what a "flow" looks like
// across the whole backend (CRUD, engine, webhook trigger).

export type StepType = "filter" | "transform" | "http_request";

export interface FilterStep {
    type: "filter";
    field: string; // dot path, e.g. "order.amount"
    operator: "eq" | "neq" | "gt" | "lt" | "contains";
    value: unknown;
}

export interface TransformStep {
    type: "transform";
    mapping: Record<string, string>; // output field -> dot path into current data
}

export interface HttpRequestStep {
    type: "http_request";
    url: string;
    method: "POST" | "PUT";
}

export type Step = FilterStep | TransformStep | HttpRequestStep;

export interface Flow {
    _id?: string; // Mongo ObjectId as string once serialized
    name: string; // 3 to 80 chars
    description?: string;
    enabled: boolean;
    steps: Step[]; // 1 to 5 steps
    webhookSecret: string; // generated server-side on creation, never user-supplied
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
}

// Shape returned by GET /api/flows (list view) — no steps, no secret.
export type FlowSummary = Pick<Flow, "_id" | "name" | "enabled" | "createdAt" | "updatedAt">;