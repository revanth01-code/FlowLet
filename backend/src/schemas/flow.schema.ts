// Working on: runtime validation schemas (Elysia's TypeBox-based `t`).
// These double as the compile-time types for route bodies — one
// definition, validated at runtime AND type-checked at compile time.

import { t } from "elysia";

const filterStepSchema = t.Object({
    type: t.Literal("filter"),
    field: t.String({ minLength: 1 }),
    operator: t.Union([
        t.Literal("eq"),
        t.Literal("neq"),
        t.Literal("gt"),
        t.Literal("lt"),
        t.Literal("contains"),
    ]),
    value: t.Unknown(),
});

const transformStepSchema = t.Object({
    type: t.Literal("transform"),
    mapping: t.Record(t.String(), t.String()),
});

const httpRequestStepSchema = t.Object({
    type: t.Literal("http_request"),
    url: t.String({ format: "uri" }),
    method: t.Union([t.Literal("POST"), t.Literal("PUT")]),
});

export const stepSchema = t.Union([
    filterStepSchema,
    transformStepSchema,
    httpRequestStepSchema,
]);

export const createFlowSchema = t.Object({
    name: t.String({ minLength: 3, maxLength: 80 }),
    description: t.Optional(t.String()),
    enabled: t.Optional(t.Boolean()),
    steps: t.Array(stepSchema, { minItems: 1, maxItems: 5 }),
});

export const updateFlowSchema = t.Object({
    name: t.Optional(t.String({ minLength: 3, maxLength: 80 })),
    description: t.Optional(t.String()),
    enabled: t.Optional(t.Boolean()),
    steps: t.Optional(t.Array(stepSchema, { minItems: 1, maxItems: 5 })),
});

export const flowIdParamSchema = t.Object({
    id: t.String(),
});