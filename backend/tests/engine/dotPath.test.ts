import { describe, expect, test } from "bun:test";
import { getByDotPath } from "../../src/services/engine/dotPath";

describe("getByDotPath", () => {
    test("resolves a nested path", () => {
        const data = { order: { amount: 4999, customer: { email: "a@b.com" } } };
        expect(getByDotPath(data, "order.amount")).toBe(4999);
        expect(getByDotPath(data, "order.customer.email")).toBe("a@b.com");
    });

    test("returns null for a missing path", () => {
        const data = { order: { amount: 100 } };
        expect(getByDotPath(data, "order.customer.email")).toBeNull();
    });

    test("returns null when traversing through a non-object", () => {
        const data = { order: { amount: 100 } };
        expect(getByDotPath(data, "order.amount.nested")).toBeNull();
    });
});