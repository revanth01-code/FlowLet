import { describe, expect, test } from "bun:test";
import { evaluateTransform } from "../../src/services/engine/transform";
import type { TransformStep } from "../../src/models/flow.model";

describe("evaluateTransform", () => {
    test("builds a new object from dot-path mapping", () => {
        const data = {
            order: { id: "ORD-1042", amount: 4999, customer: { email: "asha@example.com" } },
        };
        const step: TransformStep = {
            type: "transform",
            mapping: {
                orderId: "order.id",
                total: "order.amount",
                email: "order.customer.email",
            },
        };

        expect(evaluateTransform(step, data)).toEqual({
            orderId: "ORD-1042",
            total: 4999,
            email: "asha@example.com",
        });
    });

    test("missing path maps to null", () => {
        const data = { order: { id: "X" } };
        const step: TransformStep = {
            type: "transform",
            mapping: { id: "order.id", missing: "order.customer.phone" },
        };

        expect(evaluateTransform(step, data)).toEqual({ id: "X", missing: null });
    });
});