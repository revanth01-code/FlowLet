// Working on: GET /api/flows/:id/runs, GET /api/flows/:id/stats,
// GET /api/runs/:runId.

import { Elysia } from "elysia";
import * as runService from "../services/run.service";
import { flowIdParamSchema, listRunsQuerySchema, runIdParamSchema } from "../schemas/run.schema";
import { ValidationError } from "../errors/AppError";

export const runsRoutes = new Elysia()
    .get(
        "/api/flows/:id/runs",
        async ({ params, query }) => {
            let limit: number | undefined;
            if (query.limit !== undefined) {
                const parsed = Number(query.limit);
                if (!Number.isInteger(parsed) || parsed < 1) {
                    throw new ValidationError("limit must be a positive integer");
                }
                limit = parsed;
            }

            return runService.listRuns(params.id, {
                status: query.status,
                limit,
                cursor: query.cursor,
            });
        },
        { params: flowIdParamSchema, query: listRunsQuerySchema },
    )

    .get(
        "/api/flows/:id/stats",
        async ({ params }) => runService.getFlowStats(params.id),
        { params: flowIdParamSchema },
    )

    .get(
        "/api/runs/:runId",
        async ({ params }) => runService.getRunById(params.runId),
        { params: runIdParamSchema },
    );