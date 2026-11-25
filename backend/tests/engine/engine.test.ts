import { describe, expect, test } from "bun:test";
import { runFlowSteps } from "../../src/services/engine/engine";
import type { Step } from "../../src/models/flow.model";

const steps: Step[] = [
    { type: "filter", field: "order.amount", operator: "gt", value: 1000 },
    {
        type: "transform",
        mapping: { orderId: "order.id", total: "order.amount", email: "order.customer.email" },
    },
];

describe("runFlowSteps", () => {
    test("passes filter then transforms — matches spec example", async () => {
        const data = { order: { id: "ORD-1042", amount: 4999, customer: { email: "asha@example.com" } } };
        const result = await runFlowSteps(steps, data);

        expect(result.status).toBe("success");
        expect(result.steps[1]!.output).toEqual({
            orderId: "ORD-1042",
            total: 4999,
            email: "asha@example.com",
        });
    });

    test("fails filter -> run is filtered, remaining steps skipped", async () => {
        const data = { order: { id: "ORD-1043", amount: 500, customer: { email: "x@y.com" } } };
        const result = await runFlowSteps(steps, data);

        expect(result.status).toBe("filtered");
        expect(result.steps[0]!.status).toBe("success"); // filter step ran fine, just said "stop"
        expect(result.steps[1]!.status).toBe("skipped");
    });
});