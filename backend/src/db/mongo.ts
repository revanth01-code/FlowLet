import { MongoClient, type Collection } from "mongodb";
import { env } from "../config/env";
import type { FlowDocument } from "../models/flow.model";

const client = new MongoClient(env.mongoUri);

let flowsCollection: Collection<FlowDocument> | null = null;

export async function connectMongo(): Promise<void> {
    await client.connect();
    const db = client.db(env.mongoDbName);
    flowsCollection = db.collection<FlowDocument>("flows");

    // Serves: GET /api/flows filtering/sorting by enabled state, and the
    // webhook trigger's "is this flow enabled?" check on every event.
    await flowsCollection.createIndex({ enabled: 1 });

    console.log(`Connected to MongoDB (${env.mongoDbName})`);
}

export function getFlowsCollection(): Collection<FlowDocument> {
    if (!flowsCollection) {
        throw new Error("Mongo not connected yet — call connectMongo() first.");
    }
    return flowsCollection;
}

export async function disconnectMongo(): Promise<void> {
    await client.close();
}