// Working on: filter step — reads a field, compares it with `operator`,
// and returns a boolean. The engine decides what to do with that result
// (continue vs. stop the run as "filtered").

import type { FilterStep } from "../../models/flow.model";
import { getByDotPath } from "./dotPath";

export function evaluateFilter(step: FilterStep, data: unknown): boolean {
    const actual = getByDotPath(data, step.field);

    switch (step.operator) {
        case "eq":
            return actual === step.value;
        case "neq":
            return actual !== step.value;
        case "gt":
            return typeof actual === "number" && typeof step.value === "number" && actual > step.value;
        case "lt":
            return typeof actual === "number" && typeof step.value === "number" && actual < step.value;
        case "contains":
            if (typeof actual === "string" && typeof step.value === "string") {
                return actual.includes(step.value);
            }
            if (Array.isArray(actual)) {
                return actual.includes(step.value);
            }
            return false;
    }
}