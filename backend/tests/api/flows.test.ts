import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { connectMongo, disconnectMongo } from "../../src/db/mongo";
import { createHmac } from "node:crypto";

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

// Add this below the existing describe block, in the same file,
// reusing the `app` from beforeAll.
beforeAll(async () => {
    await connectMongo();
    app = createApp();
});


describe("duplicate event detection", () => {
    async function createTestFlow() {
        const response = await app.handle(
            new Request("http://localhost/api/flows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Dedup test flow",
                    steps: [{ type: "filter", field: "x", operator: "eq", value: 1 }],
                }),
            }),
        );
        return response.json();
    }

    function sign(body: string, secret: string): string {
        return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    }

    test("same event_id returns the original run instead of creating a new one", async () => {
        const flow = await createTestFlow();
        const body = JSON.stringify({ x: 1 });
        const signature = sign(body, flow.webhookSecret);

        const firstResponse = await app.handle(
            new Request(`http://localhost/api/hooks/${flow._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Flowlet-Signature": signature,
                    "X-Event-Id": "evt-123",
                },
                body,
            }),
        );
        const first = await firstResponse.json();

        const secondResponse = await app.handle(
            new Request(`http://localhost/api/hooks/${flow._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Flowlet-Signature": signature,
                    "X-Event-Id": "evt-123",
                },
                body,
            }),
        );
        const second = await secondResponse.json();

        expect(secondResponse.status).toBe(200);
        expect(second.runId).toBe(first.runId); // same run, not a new one
        expect(second.status).toBe(first.status);
    });

    test("different event_id creates a separate run", async () => {
        const flow = await createTestFlow();
        const body = JSON.stringify({ x: 1 });
        const signature = sign(body, flow.webhookSecret);

        const firstResponse = await app.handle(
            new Request(`http://localhost/api/hooks/${flow._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Flowlet-Signature": signature,
                    "X-Event-Id": "evt-aaa",
                },
                body,
            }),
        );
        const first = await firstResponse.json();

        const secondResponse = await app.handle(
            new Request(`http://localhost/api/hooks/${flow._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Flowlet-Signature": signature,
                    "X-Event-Id": "evt-bbb",
                },
                body,
            }),
        );
        const second = await secondResponse.json();

        expect(second.runId).not.toBe(first.runId); // different event -> different run
    });
});