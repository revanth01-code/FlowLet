-- Working on: run_steps table — one row per step executed within a run.
-- Linked to runs via a foreign key with ON DELETE CASCADE: if a run is ever
-- deleted, its step records go with it (a run without its steps is meaningless).

CREATE TABLE IF NOT EXISTS run_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,            -- 0-based order within the run
    type            TEXT NOT NULL CHECK (type IN ('filter', 'transform', 'http_request')),
    status          TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    input           JSONB NOT NULL,
    output          JSONB,
    error_message   TEXT,
    duration_ms     INTEGER NOT NULL
);

-- Serves: GET /api/runs/:runId, which needs all steps for one run, in order.
CREATE INDEX IF NOT EXISTS idx_run_steps_run_position
    ON run_steps (run_id, position);