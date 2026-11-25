// Working on: http_request step — posts the current data as JSON with a
// 5s timeout. Per spec 3.1: a network error, timeout, or non-2xx fails
// the step (and the run). We capture status + first 2KB of body as the
// step's output either way (useful for debugging a failed call too).

import type { HttpRequestStep } from "../../models/flow.model";

const TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 2 * 1024; // 2 KB

export interface HttpStepResult {
    ok: boolean;
    status: number | null;
    body: string; // truncated to 2KB
    error: string | null;
}

export async function executeHttpRequest(
    step: HttpRequestStep,
    data: unknown,
): Promise<HttpStepResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(step.url, {
            method: step.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            signal: controller.signal,
        });

        const rawBody = await response.text();
        const truncatedBody = rawBody.slice(0, MAX_BODY_BYTES);

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                body: truncatedBody,
                error: `Non-2xx response: ${response.status}`,
            };
        }

        return { ok: true, status: response.status, body: truncatedBody, error: null };
    } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        return {
            ok: false,
            status: null,
            body: "",
            error: isAbort ? "Request timed out after 5s" : `Network error: ${(err as Error).message}`,
        };
    } finally {
        clearTimeout(timeout);
    }
}