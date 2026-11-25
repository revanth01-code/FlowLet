// Working on: the orchestrator — runs a flow's steps in order against
// incoming data, producing one result per step plus the run's overall
// status. This is the function the webhook route will call in step 6;
// it does NOT touch Postgres itself (keeps it pure and testable).

import type { Step } from "../../models/flow.model";
import { evaluateFilter } from "./filter";
import { evaluateTransform } from "./transform";
import { executeHttpRequest } from "./httpRequest";

export type RunStatus = "success" | "filtered" | "failed";
export type StepStatus = "success" | "failed" | "skipped";

export interface StepResult {
    position: number;
    type: Step["type"];
    status: StepStatus;
    input: unknown;
    output: unknown;
    error: string | null;
    durationMs: number;
}

export interface EngineResult {
    status: RunStatus;
    steps: StepResult[];
    errorMessage: string | null;
}

export async function runFlowSteps(steps: Step[], initialData: unknown): Promise<EngineResult> {
    const results: StepResult[] = [];
    let currentData: unknown = initialData;
    let runStatus: RunStatus = "success";
    let runError: string | null = null;
    let stopped = false; // true once filtered or failed — remaining steps get "skipped"

    for (let position = 0; position < steps.length; position++) {
        const step = steps[position]!;
        const input = currentData;

        if (stopped) {
            results.push({
                position,
                type: step.type,
                status: "skipped",
                input,
                output: null,
                error: null,
                durationMs: 0,
            });
            continue;
        }

        const start = performance.now();

        if (step.type === "filter") {
            const passed = evaluateFilter(step, currentData);
            const durationMs = performance.now() - start;

            if (!passed) {
                results.push({
                    position,
                    type: "filter",
                    status: "success", // the filter step itself ran correctly — it just said "stop"
                    input,
                    output: { passed: false },
                    error: null,
                    durationMs,
                });
                runStatus = "filtered";
                stopped = true;
                continue;
            }

            results.push({
                position,
                type: "filter",
                status: "success",
                input,
                output: { passed: true },
                error: null,
                durationMs,
            });
            continue;
        }

        if (step.type === "transform") {
            const output = evaluateTransform(step, currentData);
            const durationMs = performance.now() - start;

            currentData = output;
            results.push({
                position,
                type: "transform",
                status: "success",
                input,
                output,
                error: null,
                durationMs,
            });
            continue;
        }

        // http_request
        const result = await executeHttpRequest(step, currentData);
        const durationMs = performance.now() - start;

        if (!result.ok) {
            results.push({
                position,
                type: "http_request",
                status: "failed",
                input,
                output: { status: result.status, body: result.body },
                error: result.error,
                durationMs,
            });
            runStatus = "failed";
            runError = result.error;
            stopped = true;
            continue;
        }

        results.push({
            position,
            type: "http_request",
            status: "success",
            input,
            output: { status: result.status, body: result.body },
            error: null,
            durationMs,
        });
    }

    return { status: runStatus, steps: results, errorMessage: runError };
}