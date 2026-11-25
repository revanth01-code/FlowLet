"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFlow, getFlowStats, listRuns, deleteFlow, ApiError } from "@/lib/api-client";
import type { Flow, FlowStats, RunSummary, RunStatus } from "@/lib/types";
import RunStatusBadge from "@/components/run-status-badge";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

// ─── Send-test-event box ──────────────────────────────────────────────────────

function TestEventBox({ flow }: { flow: Flow }) {
  const [rawJson, setRawJson] = useState('{\n  "event": "test",\n  "data": {}\n}');
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const send = async () => {
    setJsonError(null);
    setResult(null);

    // Validate the user's JSON before sending
    try {
      JSON.parse(rawJson);
    } catch {
      setJsonError("Invalid JSON — please fix it before sending.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/sign-and-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowId: flow._id,
          secret: flow.webhookSecret,
          // Pass the exact string the user typed — the Route Handler signs these exact bytes
          payload: rawJson,
        }),
      });
      const json = await res.json() as { runId?: string; status?: string; error?: { message: string } };
      if (!res.ok) {
        setResult(`Error: ${json.error?.message ?? "unknown error"}`);
      } else {
        setResult(`✓ Run ${json.runId ?? ""} — status: ${json.status ?? ""}`);
      }
    } catch (err) {
      setResult(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card">
      <h2>Send test event</h2>
      <div className="form-group">
        <label htmlFor="test-payload">Payload (raw JSON)</label>
        <textarea
          id="test-payload"
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          style={{ fontFamily: "monospace", minHeight: "120px" }}
        />
        {jsonError && <span className="field-error" role="alert">{jsonError}</span>}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={sending || !flow.enabled}
        onClick={send}
        title={!flow.enabled ? "Flow is disabled — enable it first" : undefined}
      >
        {sending ? "Sending…" : "Send"}
      </button>
      {!flow.enabled && (
        <p style={{ fontSize: "0.82rem", color: "#666", marginTop: "0.4rem" }}>
          Flow is disabled — enable it to trigger.
        </p>
      )}
      {result && (
        <pre
          className="code-block"
          style={{ marginTop: "0.6rem", fontSize: "0.82rem" }}
          aria-live="polite"
        >
          {result}
        </pre>
      )}
    </div>
  );
}

// ─── Run history ──────────────────────────────────────────────────────────────

function RunHistory({ flowId }: { flowId: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RunStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(
    async (cursor?: string, status?: RunStatus | "") => {
      try {
        const page = await listRuns(flowId, {
          status: status || undefined,
          limit: 20,
          cursor,
        });
        if (cursor) {
          setRuns((prev) => [...prev, ...page.items]);
        } else {
          setRuns(page.items);
        }
        setNextCursor(page.nextCursor);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.body.error.message
            : "Failed to load runs.";
        setError(msg);
      }
    },
    [flowId],
  );

  // Initial + filter-change load
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRuns(undefined, statusFilter).finally(() => setLoading(false));
  }, [fetchRuns, statusFilter]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchRuns(nextCursor, statusFilter);
    setLoadingMore(false);
  };

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Run history</h2>
        <div className="form-group" style={{ margin: 0, flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
          <label htmlFor="run-status-filter" style={{ fontWeight: "normal", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            Filter by status
          </label>
          <select
            id="run-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RunStatus | "")}
            style={{ width: "auto" }}
          >
            <option value="">All</option>
            <option value="success">success</option>
            <option value="filtered">filtered</option>
            <option value="failed">failed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading runs…</p>
      ) : error ? (
        <div className="error-banner" role="alert">{error}</div>
      ) : runs.length === 0 ? (
        <p className="empty">
          No runs yet — trigger the webhook to see one here.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/runs/${r.id}`}>
                        <RunStatusBadge status={r.status} />
                      </Link>
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      <Link href={`/runs/${r.id}`}>
                        {new Date(r.startedAt).toLocaleString()}
                      </Link>
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{r.durationMs}ms</td>
                    <td style={{ fontSize: "0.8rem", color: "#900", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.errorMessage ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="pagination">
              <button
                type="button"
                className="btn"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [stats, setStats] = useState<FlowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Fetch flow and stats independently so a stats failure doesn't block
    // the whole page — stats are supplementary information.
    getFlow(id)
      .then((f) => {
        setFlow(f);
        // Fire stats fetch after flow resolves; failure shows no stats card
        // rather than a full-page error.
        getFlowStats(id)
          .then(setStats)
          .catch(() => {
            // Stats unavailable — page still renders without the stats card.
            // No setError here: flow data is the critical path.
            setStats(null);
          });
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.body.error.message
            : "Failed to load flow."
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Delete this flow? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteFlow(id);
      router.push("/flows");
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.body.error.message
          : "Delete failed."
      );
      setDeleting(false);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;
  if (error) return <div className="error-banner" role="alert">{error}</div>;
  if (!flow) return null;

  const webhookUrl = `${API_URL}/api/hooks/${flow._id}`;
  const curlExample = `# 1. Compute the signature:
BODY='{"event":"test"}'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${flow.webhookSecret}" | awk '{print $2}')"

# 2. Send the webhook:
curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Flowlet-Signature: $SIG" \\
  -d "$BODY"`;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1>{flow.name}</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={`/flows/${id}/edit`} className="btn">Edit</Link>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="card">
        <RunStatusBadge status={flow.enabled ? "on" : "off"} />
        {flow.description && (
          <p style={{ margin: "0.5rem 0 0", color: "#555" }}>{flow.description}</p>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="card">
          <h2>Stats</h2>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">Total runs</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{stats.success}</div>
              <div className="stat-label">Success</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{stats.filtered}</div>
              <div className="stat-label">Filtered</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{stats.failed}</div>
              <div className="stat-label">Failed</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">
                {stats.avgDurationMs !== null ? `${stats.avgDurationMs.toFixed(0)}ms` : "—"}
              </div>
              <div className="stat-label">Avg duration</div>
            </div>
          </div>
          {stats.lastRunAt && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.82rem", color: "#555" }}>
              Last run: {new Date(stats.lastRunAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Webhook URL */}
      <div className="card">
        <h2>Webhook URL</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <code style={{ background: "#f4f4f4", padding: "0.3rem 0.5rem", borderRadius: 4, fontSize: "0.85rem", wordBreak: "break-all" }}>
            {webhookUrl}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => copyToClipboard(webhookUrl)}
          >
            Copy URL
          </button>
        </div>

        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
            curl example (with HMAC signature)
          </summary>
          <pre className="code-block" style={{ marginTop: "0.5rem" }}>
            {curlExample}
          </pre>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: "0.4rem" }}
            onClick={() => copyToClipboard(curlExample)}
          >
            Copy curl
          </button>
        </details>

        <div style={{ marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.82rem", color: "#555" }}>
            Webhook secret:{" "}
            <code style={{ background: "#f4f4f4", padding: "0.1rem 0.4rem", borderRadius: 3, fontSize: "0.82rem" }}>
              {flow.webhookSecret}
            </code>
          </span>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginLeft: "0.5rem" }}
            onClick={() => copyToClipboard(flow.webhookSecret)}
          >
            Copy secret
          </button>
        </div>
      </div>

      {/* Send test event */}
      <TestEventBox flow={flow} />

      {/* Run history */}
      <RunHistory flowId={id} />
    </div>
  );
}
