"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listFlows, ApiError } from "@/lib/api-client";
import type { FlowSummary } from "@/lib/types";
import RunStatusBadge from "@/components/run-status-badge";

/*
 * Design decision: the spec allows showing "—" for each flow's latest-run status
 * on the list page if per-row fetches would be too many.  We fetch the latest run
 * for each flow individually (GET /api/flows/:id/runs?limit=1).  For large lists
 * this is O(n) requests; acceptable for a small-scale tool.  If perf becomes an
 * issue, swap to showing "—" for all rows.
 */

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Latest run status per flow _id: "success" | "filtered" | "failed" | "none" | "loading"
  const [latestRunStatus, setLatestRunStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    listFlows()
      .then((data) => {
        setFlows(data);
        // Fire off per-flow latest-run requests (non-blocking)
        data.forEach((f) => {
          setLatestRunStatus((prev) => ({ ...prev, [f._id]: "loading" }));
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/flows/${f._id}/runs?limit=1`)
            .then((r) => r.json())
            .then((page: { items: Array<{ status: string }> }) => {
              const status = page.items[0]?.status ?? "none";
              setLatestRunStatus((prev) => ({ ...prev, [f._id]: status }));
            })
            .catch(() => {
              setLatestRunStatus((prev) => ({ ...prev, [f._id]: "none" }));
            });
        });
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.body.error.message
            : "Failed to load flows.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading flows…</p>;

  if (error)
    return (
      <div>
        <div className="error-banner" role="alert">{error}</div>
      </div>
    );

  return (
    <div>
      <div className="page-header">
        <h1>Flows</h1>
        <Link href="/flows/new" className="btn btn-primary">+ New flow</Link>
      </div>

      {flows.length === 0 ? (
        <div className="empty">
          <p>No flows yet.</p>
          <Link href="/flows/new" className="btn btn-primary">Create your first flow</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Enabled</th>
                <th>Latest run</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => {
                const runStatus = latestRunStatus[f._id];
                return (
                  <tr key={f._id}>
                    <td>
                      <Link href={`/flows/${f._id}`}>{f.name}</Link>
                    </td>
                    <td>
                      <RunStatusBadge status={f.enabled ? "on" : "off"} />
                    </td>
                    <td>
                      {runStatus === "loading" ? (
                        <span style={{ color: "#888", fontSize: "0.8rem" }}>…</span>
                      ) : !runStatus || runStatus === "none" ? (
                        <span style={{ color: "#888" }}>—</span>
                      ) : (
                        <RunStatusBadge
                          status={runStatus as "success" | "filtered" | "failed"}
                        />
                      )}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "#555" }}>
                      {new Date(f.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
