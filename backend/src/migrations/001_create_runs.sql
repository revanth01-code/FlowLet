-- Working on: runs table — one row per webhook trigger / flow execution.

CREATE TABLE IF NOT EXISTS runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id         TEXT NOT NULL,              -- Mongo ObjectId as string, no FK across DBs
    status          TEXT NOT NULL CHECK (status IN ('success', 'filtered', 'failed')),
    payload         JSONB NOT NULL,              -- the raw incoming event body
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms     INTEGER NOT NULL
);

-- Serves: GET /api/flows/:id/runs?status=&limit=&cursor=
-- which filters by flow_id (+ optional status) and orders by started_at DESC for cursor pagination.
CREATE INDEX IF NOT EXISTS idx_runs_flow_started
    ON runs (flow_id, started_at DESC);

-- Serves: GET /api/flows/:id/stats, which filters by flow_id and groups by status.
CREATE INDEX IF NOT EXISTS idx_runs_flow_status
    ON runs (flow_id, status);