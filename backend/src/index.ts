// Working on: entry point — now also connects to MongoDB before the
// server starts accepting requests.

import { Elysia } from "elysia";
import { env } from "./config/env";
import { connectMongo } from "./db/mongo";

async function start() {
    await connectMongo();

    const app = new Elysia().get("/health", () => ({
        status: "ok",
        service: "flowlet-backend",
    }));

    app.listen(env.port, () => {
        console.log(`Flowlet backend running at http://localhost:${env.port}`);
    });
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});