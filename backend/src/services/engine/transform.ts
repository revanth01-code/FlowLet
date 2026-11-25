// Working on: transform step — builds a brand-new object from `mapping`,
// where each value is a dot path into the current data. A missing path
// resolves to null (dotPath's own contract), not an error.

import type { TransformStep } from "../../models/flow.model";
import { getByDotPath } from "./dotPath";

export function evaluateTransform(step: TransformStep, data: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [outputKey, path] of Object.entries(step.mapping)) {
        result[outputKey] = getByDotPath(data, path);
    }

    return result;
}