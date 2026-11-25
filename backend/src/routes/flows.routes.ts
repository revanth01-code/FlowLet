// Working on: /api/flows routes. Validation happens declaratively via
// the schemas (Elysia validates the body/params before the handler
// runs), so handlers stay thin — just call the service layer.

import { Elysia } from "elysia";
import { createFlowSchema, flowIdParamSchema, updateFlowSchema } from "../schemas/flow.schema";
import * as flowService from "../services/flow.service";

export const flowsRoutes = new Elysia({ prefix: "/api/flows" })
    .post(
        "/",
        async ({ body, set }) => {
            const flow = await flowService.createFlow(body);
            set.status = 201;
            return flow;
        },
        { body: createFlowSchema },
    )

    .get("/", async () => flowService.listFlows())

    .get(
        "/:id",
        async ({ params }) => flowService.getFlowById(params.id),
        { params: flowIdParamSchema },
    )

    .patch(
        "/:id",
        async ({ params, body }) => flowService.updateFlow(params.id, body),
        { params: flowIdParamSchema, body: updateFlowSchema },
    )

    .delete(
        "/:id",
        async ({ params, set }) => {
            await flowService.deleteFlow(params.id);
            set.status = 204;
        },
        { params: flowIdParamSchema },
    );