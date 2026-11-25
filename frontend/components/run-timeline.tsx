"use client";

import type { RunDetail, RunStepDetail } from "@/lib/types";
import RunStatusBadge from "./run-status-badge";

function StepItem({ step }: { step: RunStepDetail }) {
  const isSkipped = step.status === "skipped";
  return (
    <li className={`timeline-item${isSkipped ? " skipped" : ""}`}>
      <div className="timeline-item-header">
        <span>#{step.position + 1}</span>
        <span>{step.type}</span>
        <RunStatusBadge status={step.status} />
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#555" }}>
          {step.durationMs}ms
        </span>
      </div>

      {step.error && (
        <p style={{ color: "#c00", fontSize: "0.85rem", margin: "0.3rem 0" }}>
          {step.error}
        </p>
      )}

      <div className="timeline-io">
        <details>
          <summary>Input</summary>
          <pre>{JSON.stringify(step.input, null, 2)}</pre>
        </details>
        {!isSkipped && (
          <details>
            <summary>Output</summary>
            <pre>{JSON.stringify(step.output, null, 2)}</pre>
          </details>
        )}
      </div>
    </li>
  );
}

export default function RunTimeline({ run }: { run: RunDetail }) {
  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: "0.5rem" }}>
          Run&nbsp;
          <RunStatusBadge status={run.status} />
        </h2>
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.2rem 1rem", fontSize: "0.88rem" }}>
          <dt><strong>Started</strong></dt>
          <dd style={{ margin: 0 }}>{new Date(run.startedAt).toLocaleString()}</dd>
          <dt><strong>Finished</strong></dt>
          <dd style={{ margin: 0 }}>{new Date(run.finishedAt).toLocaleString()}</dd>
          <dt><strong>Duration</strong></dt>
          <dd style={{ margin: 0 }}>{run.durationMs}ms</dd>
          {run.errorMessage && (
            <>
              <dt><strong>Error</strong></dt>
              <dd style={{ margin: 0, color: "#c00" }}>{run.errorMessage}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="card">
        <h2>Payload</h2>
        <pre className="code-block">{JSON.stringify(run.payload, null, 2)}</pre>
      </div>

      <h2 style={{ fontSize: "1rem", margin: "1rem 0 0.5rem" }}>Steps</h2>
      {run.steps.length === 0 ? (
        <p className="empty">No step details recorded.</p>
      ) : (
        <ul className="timeline">
          {run.steps.map((s) => (
            <StepItem key={s.position} step={s} />
          ))}
        </ul>
      )}
    </div>
  );
}
