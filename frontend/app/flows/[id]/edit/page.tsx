"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getFlow, ApiError } from "@/lib/api-client";
import type { Flow } from "@/lib/types";
import FlowForm from "@/components/flow-form";

export default function EditFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getFlow(id)
      .then(setFlow)
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.body.error.message
            : "Failed to load flow."
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="loading">Loading…</p>;
  if (error) return <div className="error-banner" role="alert">{error}</div>;
  if (!flow) return null;

  return (
    <div>
      <div className="page-header">
        <h1>Edit: {flow.name}</h1>
      </div>
      <FlowForm initialData={flow} />
    </div>
  );
}
