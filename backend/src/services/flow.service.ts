// Working on: Mongo CRUD for flows. Webhook secret generation lives here
// (server-generated, per spec 3.1) — never accepted from request bodies.

import { ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { getFlowsCollection } from "../db/mongo";
import type {
    CreateFlowInput,
    Flow,
    FlowDocument,
    FlowSummary,
    UpdateFlowInput,
} from "../models/flow.model";
import { NotFoundError } from "../errors/AppError";

function generateWebhookSecret(): string {
    return randomBytes(32).toString("hex");
}

// An invalid-format id makes `new ObjectId()` throw. We collapse that
// into the same 404 as "flow doesn't exist" — the API contract only
// distinguishes "flow does not exist" from other errors, not malformed
// vs. missing ids.
function toObjectId(id: string): ObjectId {
    try {
        return new ObjectId(id);
    } catch {
        throw new NotFoundError("Flow");
    }
}

function toFlow(doc: FlowDocument): Flow {
    if (!doc._id) {
        throw new Error("Flow document missing _id — this should never happen.");
    }
    return { ...doc, _id: doc._id.toString() };
}

// Drops keys whose value is `undefined` so we never write an explicit
// `undefined` into Mongo (and stay compatible with
// exactOptionalPropertyTypes in strict mode).
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
}

export async function createFlow(input: CreateFlowInput): Promise<Flow> {
    const now = new Date().toISOString();

    const doc: FlowDocument = {
        name: input.name,
        enabled: input.enabled ?? true,
        steps: input.steps,
        webhookSecret: generateWebhookSecret(),
        createdAt: now,
        updatedAt: now,
        ...(input.description !== undefined ? { description: input.description } : {}),
    };

    const result = await getFlowsCollection().insertOne(doc);
    return toFlow({ ...doc, _id: result.insertedId });
}

// Serves: GET /api/flows. Positive-inclusion projection (only the fields
// we actually want) rather than exclusion — excludes `steps` and
// `webhookSecret` per the contract, and a limit bounds the read
// (engineering requirement: projection + limit).
const LIST_LIMIT = 100;

export async function listFlows(): Promise<FlowSummary[]> {
    const docs = await getFlowsCollection()
        .find({}, { projection: { name: 1, enabled: 1, createdAt: 1, updatedAt: 1 } })
        .limit(LIST_LIMIT)
        .toArray();

    return docs.map((doc) => ({
        _id: doc._id!.toString(),
        name: doc.name,
        enabled: doc.enabled,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    }));
}

export async function getFlowById(id: string): Promise<Flow> {
    const doc = await getFlowsCollection().findOne({ _id: toObjectId(id) });
    if (!doc) throw new NotFoundError("Flow");
    return toFlow(doc);
}

export async function updateFlow(id: string, patch: UpdateFlowInput): Promise<Flow> {
    const result = await getFlowsCollection().findOneAndUpdate(
        { _id: toObjectId(id) },
        { $set: { ...removeUndefined(patch), updatedAt: new Date().toISOString() } },
        { returnDocument: "after" },
    );

    if (!result) throw new NotFoundError("Flow");
    return toFlow(result);
}

export async function deleteFlow(id: string): Promise<void> {
    const result = await getFlowsCollection().deleteOne({ _id: toObjectId(id) });
    if (result.deletedCount === 0) throw new NotFoundError("Flow");
}