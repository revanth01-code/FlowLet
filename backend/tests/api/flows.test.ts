import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { connectMongo, disconnectMongo } from "../../src/db/mongo";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
    await connectMongo();
    app = createApp();
});

afterAll(async () => {
    await disconnectMongo();
});

describe("POST /api/flows", () => {
    test("creates a flow and returns it with a generated secret", async () => {
        const response = await app.handle(
            new Request("http://localhost/api/flows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "API test flow",
                    steps: [{ type: "filter", field: "x", operator: "eq", value: 1 }],
                }),
            }),
        );

        expect(response.status).toBe(201);

        const body = await response.json();
        expect(body.name).toBe("API test flow");
        expect(typeof body._id).toBe("string");
        expect(typeof body.webhookSecret).toBe("string");
    });

    test("rejects a name under 3 characters with 400", async () => {
        const response = await app.handle(
            new Request("http://localhost/api/flows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "ab",
                    steps: [{ type: "filter", field: "x", operator: "eq", value: 1 }],
                }),
            }),
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });
});