// Working on: writes a completed run + its step records to Postgres,
// inside one transaction (a run without all its steps recorded would
// be a worse bug than the whole write failing).

import { pool } from "../db/postgres";
import type { EngineResult } from "./engine/engine";

export interface CreateRunInput {
    flowId: string;
    payload: unknown;
    result: EngineResult;
    startedAt: Date;
    finishedAt: Date;
}

export async function recordRun(input: CreateRunInput): Promise<string> {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const durationMs = input.finishedAt.getTime() - input.startedAt.getTime();

        const runResult = await client.query<{ id: string }>(
            `INSERT INTO runs (flow_id, status, payload, error_message, started_at, finished_at, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
            [
                input.flowId,
                input.result.status,
                JSON.stringify(input.payload),
                input.result.errorMessage,
                input.startedAt.toISOString(),
                input.finishedAt.toISOString(),
                Math.round(durationMs),
            ],
        );

        const runId = runResult.rows[0]!.id;

        for (const step of input.result.steps) {
            await client.query(
                `INSERT INTO run_steps (run_id, position, type, status, input, output, error_message, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    runId,
                    step.position,
                    step.type,
                    step.status,
                    JSON.stringify(step.input),
                    step.output !== null ? JSON.stringify(step.output) : null,
                    step.error,
                    Math.round(step.durationMs),
                ],
            );
        }

        await client.query("COMMIT");
        return runId;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}