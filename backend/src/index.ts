import { env } from "./config/env";
import { connectMongo } from "./db/mongo";
import { createApp } from "./app";

async function start() {
    await connectMongo();
    const app = createApp();

    app.listen(env.port, () => {
        console.log(`Flowlet backend running at http://localhost:${env.port}`);
    });
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});