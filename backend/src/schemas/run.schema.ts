// Working on: validation for the runs-list query params.

import { t } from "elysia";

export const listRunsQuerySchema = t.Object({
    status: t.Optional(t.Union([t.Literal("success"), t.Literal("filtered"), t.Literal("failed")])),
    limit: t.Optional(t.String()), // query params arrive as strings; we parse+clamp manually
    cursor: t.Optional(t.String()),
});

export const runIdParamSchema = t.Object({
    runId: t.String(),
});

export const flowIdParamSchema = t.Object({
    id: t.String(),
});