// Working on: app factory — separates "build the Elysia app" from
// "connect to Mongo and listen on a port", so tests can import createApp()
// and call .handle() directly without starting a real HTTP server.

import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { flowsRoutes } from "./routes/flows.routes";
import { hooksRoutes } from "./routes/hooks.routes";
import { runsRoutes } from "./routes/runs.routes";
import { mockRoutes } from "./routes/mock.routes";
import { AppError } from "./errors/AppError";

export function createApp() {
    return new Elysia()
        .use(
            cors({
                origin: "http://localhost:3000", // the Next.js frontend
                methods: ["GET", "POST", "PATCH", "DELETE"],
            }),
        )
        .onError(({ error, code, set }) => {
            if (error instanceof AppError) {
                set.status = error.statusCode;
                return error.toResponse();
            }

            if (code === "VALIDATION") {
                set.status = 400;
                return { error: { code: "VALIDATION_ERROR", message: error.message, details: {} } };
            }

            console.error(error);
            set.status = 500;
            return { error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: {} } };
        })
        .get("/health", () => ({ status: "ok", service: "flowlet-backend" }))
        .use(flowsRoutes)
        .use(hooksRoutes)
        .use(runsRoutes)
        .use(mockRoutes);
}