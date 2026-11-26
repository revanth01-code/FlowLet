# Flowlet

A mini webhook automation service — built for the Octaviaflow Full Stack Developer Intern take-home task.

## How to run

**Prerequisites:** Docker, Bun, Node.js (for the frontend).

```bash
git clone "https://github.com/revanth01-code/FlowLet.git"
cd flowlet

# Root-level env (controls docker-compose host ports)
cp .env.example .env

# Backend env
cd backend
cp .env.example .env
cd ..

docker compose up -d        # MongoDB and PostgreSQL

cd backend
bun install
bun run migrate
bun run dev                 # backend on http://localhost:4000

# in a second terminal
cd frontend
npm install
npm run dev                 # frontend on http://localhost:3000

# in a third terminal, to run tests
cd backend
bun test
```

**Port conflicts:** if port `27017` or `5434` is already in use on your machine (e.g. a
native MongoDB/Postgres install), set `MONGO_PORT` / `POSTGRES_PORT` in the root `.env`
before running `docker compose up -d`, and update the matching `PGPORT` /
`MONGO_URI` in `backend/.env` to match.

## How the code is organized

```
flowlet/
├── docker-compose.yml       # MongoDB + PostgreSQL, ports configurable via .env
├── backend/
│   └── src/
│       ├── config/env.ts            # typed, fail-fast environment loader
│       ├── db/                      # Mongo client + Postgres pool
│       ├── migrations/              # committed .sql files + a runner script
│       ├── models/                  # Flow/Step TypeScript types
│       ├── schemas/                 # runtime request validation (Elysia/TypeBox)
│       ├── services/
│       │   ├── engine/              # filter, transform, http_request — pure, no DB
│       │   ├── flow.service.ts      # Mongo CRUD
│       │   ├── run.service.ts       # Postgres CRUD, pagination, stats
│       │   └── signature.service.ts # HMAC verification
│       ├── routes/                  # flows, hooks (webhook), runs, mock
│       ├── errors/AppError.ts       # standard error shape
│       └── app.ts / index.ts        # app assembly vs. boot sequence
│   └── tests/                       # engine, signature, and API-level tests
└── frontend/
    └── app/                         # Next.js App Router pages
        ├── flows/                  # list, create, edit, detail
        ├── runs/[id]/              # run timeline
        └── api/sign-and-trigger/   # server-side HMAC signer for "send test event"
    └── components/                  # flow-form, step-editor, run-timeline, etc.
    └── lib/                         # typed API client, shared types
```

The backend's `services/engine/` is intentionally pure (no database or HTTP-framework
imports) so the step logic can be unit tested in isolation from everything else.

## What's finished

- Full flow CRUD (`POST/GET/PATCH/DELETE /api/flows`) with runtime validation,
  Mongo projection + limit on the list endpoint, and an index on `enabled`.
- Webhook trigger (`POST /api/hooks/:flowId`) with HMAC-SHA256 signature verification,
  all five response cases (404/401/400/409/200) in the correct order.
- The step engine: `filter`, `transform`, `http_request`, run in order, with correct
  `success`/`filtered`/`failed`/`skipped` semantics.
- Run history in PostgreSQL: `runs` + `run_steps` tables, FK with cascade delete,
  cursor-based (keyset) pagination, and a stats endpoint computed entirely in SQL.
- Full Next.js frontend covering all five required pages, each with loading, empty,
  and error states, usable at 375px width.
- 22 automated tests (`bun test`): filter operators, transform mapping, dot-path
  resolution, signature verification, API-endpoint tests, and duplicate-event tests.
- **Optional extra implemented:** idempotent webhook delivery via an `X-Event-Id`
  header (see the answer to "what happens if the same event is delivered twice?"
  below).

## What's not finished / not attempted

- No other optional extras (retry logic, replay button, CI workflow, or a deployed
  public URL) were attempted — per the task's own guidance, a complete, well-tested
  core was prioritized over partially-built extras.

## Known bugs

None currently open. One bug was found and fixed during a dedicated end-to-end
testing pass after the core build was complete: the frontend's filter-step "Value"
input submitted every value as a string, which caused numeric comparisons
(`gt`/`lt`, and numeric `eq`/`neq`) to silently evaluate as false even when the
comparison was logically true (e.g. `5000 > 1000`), because the backend engine
deliberately requires both sides of a numeric comparison to actually be JavaScript
numbers. Fixed by converting numeric-looking input to a real number before it
leaves the form, while leaving genuinely text input (e.g. `order.status eq "paid"`)
as a string. Verified afterward with a full re-test of all filter operators through
the actual UI, not just the API.

## How long I spent

Roughly 9-10 hours total: ~1.5 hours understanding the task and planning, ~3 hours
building the backend (tested feature-by-feature as I went), ~2-3 hours on the
frontend, and a final ~3 hours doing an end-to-end test pass across the whole
application (backend + frontend together) and fixing the bugs that pass surfaced —
including a frontend form bug where numeric filter values were submitted as strings,
causing numeric comparisons to silently evaluate incorrectly.

## Which AI tools I used, and for what

I used Claude (Anthropic) throughout backend development as an interactive pair: I
described the feature I needed, reviewed the code it produced before accepting it,
and manually tested every feature — including deliberately trying failure cases,
not just the happy path — before moving to the next one. Several real bugs were
caught this way during development itself (e.g. a Postgres `timestamptz`/`Date`
serialization bug in cursor pagination, an HMAC signature bug caused by a web
framework's body parser re-encoding the raw request, and the numeric-value bug
above), each found through my own manual verification rather than being pre-empted.

For the frontend, I wrote a complete specification document (`frontend-spec.md`)
covering the exact API contract, data model, required pages, and UI states, and had
Google Antigravity (an agentic IDE) build against that spec rather than working from
an unstructured prompt. I then ran a structured bug-audit pass against the finished
frontend and backend together, reviewing and verifying every reported fix manually
rather than accepting the audit's summary at face value.

I can explain and modify any line of this codebase.

## Answers to the five questions

**Why do flows fit MongoDB and runs fit PostgreSQL? Would you have chosen
differently?**
A flow's definition is a small, flexible document — a short list of steps whose
shape varies by type (filter/transform/http_request) — which fits a document
database naturally, without forcing a variable-shape list into rigid relational
columns. Run history, by contrast, is high-volume, strictly structured, and queried
in bulk (recent runs, filtered by status, aggregated into stats) — exactly what a
relational database with real indexes, transactions, and `GROUP BY`/`COUNT`
aggregation is built for. I wouldn't choose differently for this shape of data; a
single-database version would mean either flattening flows awkwardly into SQL
tables or losing relational query power over run history.

**Which indexes did you create, and which query does each serve?**
- `enabled` (MongoDB, on `flows`) — serves `GET /api/flows` and the webhook
  trigger's enabled/disabled check on every incoming event.
- `idx_runs_flow_started` (Postgres, `runs(flow_id, started_at DESC)`) — serves the
  paginated run-list query's keyset `WHERE`/`ORDER BY`.
- `idx_runs_flow_status` (Postgres, `runs(flow_id, status)`) — serves the stats
  endpoint's per-flow, per-status aggregation.
- `idx_run_steps_run_position` (Postgres, `run_steps(run_id, position)`) — serves
  fetching one run's steps in correct order for `GET /api/runs/:runId`.
- `idx_runs_flow_event_unique` (Postgres, partial unique index on
  `runs(flow_id, event_id) WHERE event_id IS NOT NULL`) — enforces and serves the
  duplicate-event lookup.

**What happens if the same event is delivered twice?**
If the sender includes an `X-Event-Id` header, Flowlet checks whether a run with
that exact `(flow_id, event_id)` pair already exists before executing any steps. If
it does, the original run's result is returned unchanged and nothing is
re-executed — this is enforced by a real unique index in Postgres, not just an
application-level check, so it's safe even under concurrent duplicate delivery. If
no `X-Event-Id` is sent, Flowlet has no way to know the event is a duplicate, and it
will run normally each time — this is a deliberate, opt-in behavior since event IDs
are the sender's responsibility to generate meaningfully.

**What happens to the run history when a flow is deleted? Why that choice?**
Run history is preserved, not deleted. `runs.flow_id` is a plain string, not a
foreign key into MongoDB (a real cross-database foreign key isn't possible), so
deleting a flow simply orphans its existing runs rather than cascading the delete.
I chose this deliberately: run history is an audit trail of what actually happened,
and silently destroying that record when a flow definition is removed seemed like
the wrong default for a system built around traceability. A production version
might instead soft-delete flows (keep the Mongo document but mark it deleted) so
orphaned runs could still resolve back to a flow name — I'd consider that if this
were headed to production.

**If this service received 100 events per second, what would break first, and what
would you change?**
The webhook handler currently runs a flow's steps synchronously and only responds
once every step (including any `http_request` step, which can take up to 5 seconds
on a timeout) has finished. Under sustained 100 events/sec, any flow with a slow or
failing downstream `http_request` step would back up request handling, since the
response is blocked on that external call completing. I'd change this by having the
webhook endpoint do only the fast parts synchronously (signature check, flow
lookup, dedup check) and then hand the actual step execution off to a background
queue (e.g. BullMQ/Redis), returning a `202 Accepted` immediately with a run ID the
client can poll or that the UI can update live. I'd also revisit the Postgres
connection pool size and the Mongo driver's connection pooling defaults, since both
would need to handle a higher concurrent connection count than they're currently
tuned for.
