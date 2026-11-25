// Working on: Mongo client singleton + the `flows` collection + its indexes.
// Index choice, explained:
//   - `enabled` index: GET /api/flows commonly needs to show/filter by
//     enabled state, and the webhook trigger checks `enabled` on every
//     single incoming event (3.2: "Flow is disabled -> 409"), so this is
//     a hot-path lookup.
//   - We do NOT index `name` uniquely because the spec doesn't require
//     unique flow names, only a length constraint (3-80 chars), which is
//     a validation-layer concern, not a DB-layer one.

import { MongoClient, type Collection } from "mongodb";
import { env } from "../config/env";
import type { Flow } from "../models/flow.model";

const client = new MongoClient(env.mongoUri);

let flowsCollection: Collection<Flow> | null = null;

export async function connectMongo(): Promise<void> {
    await client.connect();
    const db = client.db(env.mongoDbName);
    flowsCollection = db.collection<Flow>("flows");

    // Serves: GET /api/flows filtering/sorting by enabled state, and the
    // webhook trigger's "is this flow enabled?" check.
    await flowsCollection.createIndex({ enabled: 1 });

    console.log(`Connected to MongoDB (${env.mongoDbName})`);
}

export function getFlowsCollection(): Collection<Flow> {
    if (!flowsCollection) {
        throw new Error("Mongo not connected yet — call connectMongo() first.");
    }
    return flowsCollection;
}

export async function disconnectMongo(): Promise<void> {
    await client.close();
}