import { describe, expect, test } from "bun:test";
import { evaluateFilter } from "../../src/services/engine/filter";
import type { FilterStep } from "../../src/models/flow.model";

describe("evaluateFilter", () => {
    const data = { order: { amount: 4999, status: "paid", tags: ["vip", "rush"] } };

    test("gt operator", () => {
        const step: FilterStep = { type: "filter", field: "order.amount", operator: "gt", value: 1000 };
        expect(evaluateFilter(step, data)).toBe(true);

        const stepFalse: FilterStep = { type: "filter", field: "order.amount", operator: "gt", value: 9999 };
        expect(evaluateFilter(stepFalse, data)).toBe(false);
    });

    test("lt operator", () => {
        const step: FilterStep = { type: "filter", field: "order.amount", operator: "lt", value: 9999 };
        expect(evaluateFilter(step, data)).toBe(true);
    });

    test("eq and neq operators", () => {
        const eqStep: FilterStep = { type: "filter", field: "order.status", operator: "eq", value: "paid" };
        expect(evaluateFilter(eqStep, data)).toBe(true);

        const neqStep: FilterStep = { type: "filter", field: "order.status", operator: "neq", value: "refunded" };
        expect(evaluateFilter(neqStep, data)).toBe(true);
    });

    test("contains operator on string", () => {
        const step: FilterStep = { type: "filter", field: "order.status", operator: "contains", value: "ai" };
        expect(evaluateFilter(step, data)).toBe(true);
    });

    test("contains operator on array", () => {
        const step: FilterStep = { type: "filter", field: "order.tags", operator: "contains", value: "vip" };
        expect(evaluateFilter(step, data)).toBe(true);
    });

    test("gt on non-numeric value returns false instead of throwing", () => {
        const step: FilterStep = { type: "filter", field: "order.status", operator: "gt", value: 10 };
        expect(evaluateFilter(step, data)).toBe(false);
    });
});