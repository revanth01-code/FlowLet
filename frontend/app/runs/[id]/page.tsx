"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { getRun, ApiError } from "@/lib/api-client";
import type { RunDetail } from "@/lib/types";
import RunTimeline from "@/components/run-timeline";

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRun(id)
      .then(setRun)
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.body.error.message
            : "Failed to load run."
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="loading">Loading run…</p>;

  if (error)
    return (
      <div>
        <div className="error-banner" role="alert">{error}</div>
      </div>
    );

  if (!run)
    return (
      <div className="empty">Run not found.</div>
    );

  return (
    <div>
      <div className="page-header">
        <h1>Run detail</h1>
        <Link href={`/flows/${run.flowId}`} className="btn">
          ← Back to flow
        </Link>
      </div>
      <RunTimeline run={run} />
    </div>
  );
}
