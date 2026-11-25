// Working on: POST /api/mock/receiver — a stand-in "external system" for
// http_request steps to call. Echoes the body back with 200, or returns
// 500 when ?fail=1 is passed, so you can test the engine's failure path
// (non-2xx -> step fails -> run fails) against a real HTTP call instead
// of just an unreachable URL.

import { Elysia } from "elysia";

export const mockRoutes = new Elysia().post("/api/mock/receiver", async ({ request, query, set }) => {
    const rawBody = await request.text();

    if (query.fail === "1") {
        set.status = 500;
        return { error: "Simulated failure", received: rawBody ? JSON.parse(rawBody) : null };
    }

    set.status = 200;
    return { echo: rawBody ? JSON.parse(rawBody) : null };
});