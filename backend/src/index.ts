// Working on: entry point — minimal Elysia app with a health check,
// just to confirm the scaffold runs before we add real features.

import { Elysia } from "elysia";
import { env } from "./config/env";

const app = new Elysia().get("/health", () => ({
    status: "ok",
    service: "flowlet-backend",
}));

app.listen(env.port, () => {
    console.log(`Flowlet backend running at http://localhost:${env.port}`);
});