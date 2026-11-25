import { Elysia } from "elysia";
import { env } from "./config/env";
import { connectMongo } from "./db/mongo";
import { flowsRoutes } from "./routes/flows.routes";
import { hooksRoutes } from "./routes/hooks.routes";
import { runsRoutes } from "./routes/runs.routes";
import { AppError } from "./errors/AppError";

async function start() {
    await connectMongo();

    const app = new Elysia()
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
        .use(runsRoutes);

    app.listen(env.port, () => {
        console.log(`Flowlet backend running at http://localhost:${env.port}`);
    });
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});