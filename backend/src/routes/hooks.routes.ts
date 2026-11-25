// Working on: POST /api/hooks/:flowId — the webhook trigger.
// NEW: if the sender includes X-Event-Id and we've already processed
// that exact (flow, event) pair, we return the ORIGINAL run's result
// instead of re-executing the flow's steps. This makes the endpoint
// safe against at-least-once delivery / retry storms from senders.

import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getFlowsCollection } from "../db/mongo";
import { verifySignature } from "../services/signature.service";
import { runFlowSteps } from "../services/engine/engine";
import { recordRun, findRunByEventId } from "../services/run.service";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../errors/AppError";

export const hooksRoutes = new Elysia().post(
    "/api/hooks/:flowId",
    async ({ params, request, headers, set }) => {
        const rawBody = await request.text();

        // 1. Flow exists?
        let objectId: ObjectId;
        try {
            objectId = new ObjectId(params.flowId);
        } catch {
            throw new NotFoundError("Flow");
        }

        const flow = await getFlowsCollection().findOne({ _id: objectId });
        if (!flow) throw new NotFoundError("Flow");

        // 2. Signature valid? No run is recorded on failure here, per spec.
        const signatureHeader = headers["x-flowlet-signature"];
        const isValid = verifySignature(rawBody, signatureHeader, flow.webhookSecret);
        if (!isValid) throw new UnauthorizedError("Signature missing or invalid");

        // 3. Body is valid JSON?
        let payload: unknown;
        try {
            payload = JSON.parse(rawBody);
        } catch {
            throw new ValidationError("Body is not valid JSON");
        }

        // 4. Flow enabled?
        if (!flow.enabled) throw new ConflictError("Flow is disabled");

        // 5. Duplicate event check — BEFORE running steps, since the whole
        // point is to avoid re-executing (e.g. a second http_request call
        // to a downstream system) on a retried delivery.
        const eventId = headers["x-event-id"] ?? null;

        if (eventId) {
            const existing = await findRunByEventId(params.flowId, eventId);
            if (existing) {
                set.status = 200;
                return { runId: existing.id, status: existing.status };
            }
        }

        // 6. Run it.
        const startedAt = new Date();
        const result = await runFlowSteps(flow.steps, payload);
        const finishedAt = new Date();

        const runId = await recordRun({
            flowId: params.flowId,
            payload,
            result,
            startedAt,
            finishedAt,
            eventId,
        });

        set.status = 200;
        return { runId, status: result.status };
    },
    { parse: "none" },
);