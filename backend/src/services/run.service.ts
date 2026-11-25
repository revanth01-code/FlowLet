import { pool } from "../db/postgres";
import type { EngineResult } from "./engine/engine";
import { NotFoundError, ValidationError } from "../errors/AppError";

// Converts pg-returned timestamptz values (JS Date objects) into
// guaranteed ISO strings.
function toIso(value: string | Date): string {
    return value instanceof Date
        ? value.toISOString()
        : new Date(value).toISOString();
}

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

        const durationMs =
            input.finishedAt.getTime() - input.startedAt.getTime();

        const runResult = await client.query<{ id: string }>(
            `INSERT INTO runs (
                flow_id,
                status,
                payload,
                error_message,
                started_at,
                finished_at,
                duration_ms
            )
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
                `INSERT INTO run_steps (
                    run_id,
                    position,
                    type,
                    status,
                    input,
                    output,
                    error_message,
                    duration_ms
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    runId,
                    step.position,
                    step.type,
                    step.status,
                    JSON.stringify(step.input),
                    step.output !== null
                        ? JSON.stringify(step.output)
                        : null,
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

export interface RunSummary {
    id: string;
    flowId: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    errorMessage: string | null;
}

export interface ListRunsResult {
    items: RunSummary[];
    nextCursor: string | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function encodeCursor(startedAt: string, id: string): string {
    return Buffer.from(`${startedAt}|${id}`).toString("base64");
}

function decodeCursor(cursor: string): {
    startedAt: string;
    id: string;
} {
    try {
        const decoded = Buffer.from(cursor, "base64").toString("utf-8");
        const [startedAt, id] = decoded.split("|");

        if (!startedAt || !id) {
            throw new Error("malformed");
        }

        return { startedAt, id };
    } catch {
        throw new ValidationError("Invalid cursor");
    }
}

export async function listRuns(
    flowId: string,
    options: {
        status?: string;
        limit?: number;
        cursor?: string;
    },
): Promise<ListRunsResult> {
    const limit = Math.min(
        options.limit ?? DEFAULT_LIMIT,
        MAX_LIMIT,
    );

    const conditions: string[] = ["flow_id = $1"];
    const values: unknown[] = [flowId];

    if (options.status) {
        values.push(options.status);
        conditions.push(`status = $${values.length}`);
    }

    if (options.cursor) {
        const { startedAt, id } = decodeCursor(options.cursor);

        values.push(startedAt, id);

        conditions.push(
            `(started_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`,
        );
    }

    values.push(limit + 1);

    const query = `
        SELECT
            id,
            flow_id,
            status,
            started_at,
            finished_at,
            duration_ms,
            error_message
        FROM runs
        WHERE ${conditions.join(" AND ")}
        ORDER BY started_at DESC, id DESC
        LIMIT $${values.length}
    `;

    const { rows } = await pool.query(query, values);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore
        ? encodeCursor(
            toIso(page[page.length - 1]!.started_at),
            page[page.length - 1]!.id,
        )
        : null;

    return {
        items: page.map((row) => ({
            id: row.id,
            flowId: row.flow_id,
            status: row.status,
            startedAt: toIso(row.started_at),
            finishedAt: toIso(row.finished_at),
            durationMs: row.duration_ms,
            errorMessage: row.error_message,
        })),
        nextCursor,
    };
}

export interface RunDetail extends RunSummary {
    payload: unknown;
    steps: Array<{
        position: number;
        type: string;
        status: string;
        input: unknown;
        output: unknown;
        error: string | null;
        durationMs: number;
    }>;
}

export async function getRunById(
    runId: string,
): Promise<RunDetail> {
    const runResult = await pool.query(
        `SELECT
            id,
            flow_id,
            status,
            payload,
            started_at,
            finished_at,
            duration_ms,
            error_message
        FROM runs
        WHERE id = $1`,
        [runId],
    );

    const run = runResult.rows[0];

    if (!run) {
        throw new NotFoundError("Run");
    }

    const stepsResult = await pool.query(
        `SELECT
            position,
            type,
            status,
            input,
            output,
            error_message,
            duration_ms
        FROM run_steps
        WHERE run_id = $1
        ORDER BY position ASC`,
        [runId],
    );

    return {
        id: run.id,
        flowId: run.flow_id,
        status: run.status,
        payload: run.payload,
        startedAt: toIso(run.started_at),
        finishedAt: toIso(run.finished_at),
        durationMs: run.duration_ms,
        errorMessage: run.error_message,
        steps: stepsResult.rows.map((row) => ({
            position: row.position,
            type: row.type,
            status: row.status,
            input: row.input,
            output: row.output,
            error: row.error_message,
            durationMs: row.duration_ms,
        })),
    };
}

export interface FlowStats {
    total: number;
    success: number;
    failed: number;
    filtered: number;
    avgDurationMs: number | null;
    lastRunAt: string | null;
}

export async function getFlowStats(
    flowId: string,
): Promise<FlowStats> {
    const { rows } = await pool.query(
        `
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'success')::int AS success,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE status = 'filtered')::int AS filtered,
            AVG(duration_ms)::float AS avg_duration_ms,
            MAX(started_at) AS last_run_at
        FROM runs
        WHERE flow_id = $1
        `,
        [flowId],
    );

    const row = rows[0];

    return {
        total: row.total,
        success: row.success,
        failed: row.failed,
        filtered: row.filtered,
        avgDurationMs: row.avg_duration_ms,
        lastRunAt: row.last_run_at
            ? toIso(row.last_run_at)
            : null,
    };
}