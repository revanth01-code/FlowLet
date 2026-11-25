// Working on: Flow + Step types. FlowDocument is what Mongo actually
// stores (_id: ObjectId). Flow is what the API returns (_id: string).
// Keeping these separate avoids ObjectId leaking into route/response code.

import type { ObjectId } from "mongodb";

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

export interface FlowDocument {
    _id?: ObjectId;
    name: string;
    description?: string;
    enabled: boolean;
    steps: Step[]; // 1 to 5 steps
    webhookSecret: string; // generated server-side, never user-supplied
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
}

export interface Flow extends Omit<FlowDocument, "_id"> {
    _id: string;
}

// Shape returned by GET /api/flows (list view) — no steps, no secret.
export type FlowSummary = Pick<Flow, "_id" | "name" | "enabled" | "createdAt" | "updatedAt">;

export type CreateFlowInput = Pick<Flow, "name" | "steps"> &
    Partial<Pick<Flow, "description" | "enabled">>;

export type UpdateFlowInput = Partial<Pick<Flow, "name" | "description" | "enabled" | "steps">>;