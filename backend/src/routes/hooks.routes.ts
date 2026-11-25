// Working on: POST /api/hooks/:flowId — the webhook trigger.
// We deliberately do NOT use Elysia's `body` parsing here: HMAC
// verification needs the exact raw request bytes, and any JSON
// parse-then-restringify (even via `type: "text"`) risks differing
// from what the sender actually signed (key order, whitespace, etc).
// Reading `request.text()` directly guarantees we get the untouched body.

import { Elysia } from "elysia";
import { ObjectId } from "mongodb";
import { getFlowsCollection } from "../db/mongo";
import { verifySignature } from "../services/signature.service";
import { runFlowSteps } from "../services/engine/engine";
import { recordRun } from "../services/run.service";
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

        // 5. Run it.
        const startedAt = new Date();
        const result = await runFlowSteps(flow.steps, payload);
        const finishedAt = new Date();

        const runId = await recordRun({
            flowId: params.flowId,
            payload,
            result,
            startedAt,
            finishedAt,
        });

        set.status = 200;
        return { runId, status: result.status };
    },
    { parse: "none" }, // tell Elysia not to pre-parse the body at all — we read it ourselves
);