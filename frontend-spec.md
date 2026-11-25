# Flowlet — Frontend Specification

## Context
Flowlet is a mini webhook automation service. The backend (already built, running at
`http://localhost:4000`) is a Bun + Elysia API backed by MongoDB (flow definitions) and
PostgreSQL (run history). This document specifies the Next.js frontend only.

## Tech stack (fixed)
- Next.js, **App Router** (not Pages Router)
- TypeScript with `"strict": true` — no `any` without a commented justification
- Bun or npm as package manager
- Runs on port 3000; backend runs on port 4000 (CORS is already enabled backend-side for
  `http://localhost:3000`)
- We are NOT judging visual design — judged on clarity and correct behavior only
- Must be usable on a 375px wide screen
- Every form field needs a `<label>`
- Every page needs a loading state, an empty state, and an error state

## Out of scope — do not build
Login/auth, user accounts, teams/permissions, a drag-and-drop canvas, background job queues,
polished visual design.

## API base URL
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```
All requests below are relative to this base.

## Data model

### Step (union type)
```ts
type Step =
  | { type: "filter"; field: string; operator: "eq" | "neq" | "gt" | "lt" | "contains"; value: unknown }
  | { type: "transform"; mapping: Record<string, string> } // output field -> dot path
  | { type: "http_request"; url: string; method: "POST" | "PUT" };
```
A flow has **1 to 5** steps.

### Flow
```ts
interface Flow {
  _id: string;
  name: string;           // 3-80 chars
  description?: string;
  enabled: boolean;
  steps: Step[];          // present on GET /api/flows/:id only, not on list
  webhookSecret: string;  // present on GET /api/flows/:id only, not on list
  createdAt: string;      // ISO
  updatedAt: string;      // ISO
}

// GET /api/flows returns this shape (no steps, no secret):
interface FlowSummary {
  _id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Run
```ts
interface RunSummary {
  id: string;             // UUID
  flowId: string;
  status: "success" | "filtered" | "failed";
  startedAt: string;       // ISO
  finishedAt: string;      // ISO
  durationMs: number;
  errorMessage: string | null;
}

interface RunDetail extends RunSummary {
  payload: unknown;        // the raw incoming event body
  steps: Array<{
    position: number;
    type: "filter" | "transform" | "http_request";
    status: "success" | "failed" | "skipped";
    input: unknown;
    output: unknown;
    error: string | null;
    durationMs: number;
  }>;
}
```

### Error shape (every 4xx/5xx response)
```ts
interface ErrorResponse {
  error: {
    code: string;          // e.g. "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED", "CONFLICT"
    message: string;
    details: Record<string, unknown>;
  };
}
```

## API endpoints (exact contract — do not deviate)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/flows` | Create a flow. Body: `{ name, description?, enabled?, steps }`. Returns `201` + full `Flow` (with secret). |
| GET | `/api/flows` | List flows. Returns `FlowSummary[]` directly (not wrapped). |
| GET | `/api/flows/:id` | One flow, with `steps` and `webhookSecret`. `404` if not found. |
| PATCH | `/api/flows/:id` | Update `name`/`description`/`enabled`/`steps` (partial body). Returns updated `Flow`. |
| DELETE | `/api/flows/:id` | Delete a flow. Returns `204` no body. |
| POST | `/api/mock/receiver` | Test target for `http_request` steps — echoes body, or `500` with `?fail=1`. Useful in the UI's "send test event" flow if a flow's http_request step targets it. |
| GET | `/api/flows/:id/runs?status=&limit=&cursor=` | Paginated run list. Returns `{ items: RunSummary[], nextCursor: string \| null }`. `status` filters by `success`/`filtered`/`failed`. Default `limit` 20, max 100. |
| GET | `/api/runs/:runId` | One run with full step detail (`RunDetail`). `404` if not found. |
| GET | `/api/flows/:id/stats` | `{ total, success, failed, filtered, avgDurationMs, lastRunAt }`. |

**Note on triggering flows for the "Send test event" UI feature:** there is no dedicated
"trigger" API for the UI — the real trigger path is `POST /api/hooks/:flowId`, which requires
a valid HMAC signature computed with the flow's `webhookSecret` over the exact raw JSON body.
The "Send test event" box (see `/flows/[id]` page spec below) must therefore, client-side or
via a small Next.js API route acting as a signer, compute:
```
signature = "sha256=" + HMAC_SHA256(raw_json_body_string, webhookSecret)
```
and send it as the `X-Flowlet-Signature` header when POSTing to
`http://localhost:4000/api/hooks/:flowId`. Since this requires Node's `crypto` module (HMAC),
do this in a Next.js Route Handler (server-side, under `app/api/...`) rather than in the
browser, so the webhook secret never needs to be exposed client-side beyond what the flow
detail page already legitimately shows it.

## Pages (App Router)

### `/flows`
List all flows: name, enabled state, and the status of each flow's **latest run** (fetch via
`GET /api/flows` + for each flow's latest run, either call `GET /api/flows/:id/runs?limit=1`
per flow, or just show "—" if that's too many requests for a list page — either is acceptable,
note the choice in the README). Loading/empty/error states required. Link each row to
`/flows/[id]`. A button/link to `/flows/new`.

### `/flows/new` and `/flows/[id]/edit`
A form to set `name` and `description`, and to add/remove/reorder up to 5 steps. Each step's
fields depend on its `type` (see Step union above) — the form needs a way to pick step type
first, then render the matching sub-fields. Invalid input (e.g. name < 3 chars, 0 steps, 6
steps, missing required step fields) shows a clear inline message next to the relevant field,
sourced from the API's `VALIDATION_ERROR` response where possible, or simple client-side
checks mirroring the same constraints (3-80 char name, 1-5 steps) for instant feedback before
hitting the API.

### `/flows/[id]`
Flow details: name, description, enabled toggle, the **webhook URL**
(`http://localhost:4000/api/hooks/:id`) with a ready-to-copy `curl` example showing the
signature computation (mirror the spec's own example, substituting this flow's real id/secret),
summary numbers (from `GET /api/flows/:id/stats`), a **"Send test event" box** (accepts raw
JSON, computes the HMAC signature server-side as described above, POSTs to the webhook, shows
the resulting `{runId, status}`), and the run history: a table/list driven by
`GET /api/flows/:id/runs`, with a status filter dropdown and "load more" (cursor) pagination.
Each run row links to `/runs/[id]`.

### `/runs/[id]`
The run as a timeline: each step in order, showing its type, status, duration, input, output,
and error (if any). Clearly distinguish `skipped` steps (e.g. greyed out) from `success`/
`failed` ones. Show the run's overall status, timestamps, and the original payload.

## Required UI states
Every page above needs:
- **Loading** — while the relevant fetch is in flight
- **Empty** — e.g. `/flows` with zero flows, or a run history with zero runs ("no runs yet —
  trigger the webhook to see one here")
- **Error** — a fetch failure or a non-2xx response; show the `error.message` from the API's
  error shape where available, otherwise a generic fallback

## Suggested frontend structure
```
frontend/
├── app/
│   ├── flows/
│   │   ├── page.tsx              # /flows
│   │   ├── new/page.tsx          # /flows/new
│   │   └── [id]/
│   │       ├── page.tsx          # /flows/[id]
│   │       └── edit/page.tsx     # /flows/[id]/edit
│   ├── runs/
│   │   └── [id]/page.tsx         # /runs/[id]
│   ├── api/
│   │   └── sign-and-trigger/route.ts   # server-side HMAC signing for "send test event"
│   └── layout.tsx
├── lib/
│   ├── api-client.ts              # typed fetch wrapper for the backend
│   └── types.ts                    # the interfaces above
├── components/
│   ├── flow-form.tsx               # shared by /flows/new and /flows/[id]/edit
│   ├── step-editor.tsx             # one step's type-specific fields
│   ├── run-status-badge.tsx
│   └── run-timeline.tsx
└── package.json
```

## A note on validation parity
The backend is the source of truth for validation (name length, step count, step field
shapes). The frontend should mirror the *same* constraints for instant feedback, but must
still handle and display a `VALIDATION_ERROR` response gracefully — don't assume client-side
checks alone are sufficient, since the API is what actually enforces correctness.