-- Working on: adds event_id for idempotent webhook delivery. Nullable
-- because not every sender will include X-Event-Id. The unique index is
-- scoped to (flow_id, event_id) rather than just event_id globally,
-- since the same event_id from two different senders/flows is a
-- coincidence, not a duplicate delivery of the same event.
--
-- Partial index (WHERE event_id IS NOT NULL) because a plain unique
-- index would otherwise reject multiple NULLs... actually Postgres
-- unique indexes already treat NULL as distinct from other NULLs, so
-- this isn't strictly required for correctness, but it's included to
-- keep the index small (it only needs to cover rows that actually use
-- this feature) and to make the intent explicit.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_flow_event_unique
    ON runs (flow_id, event_id)
    WHERE event_id IS NOT NULL;