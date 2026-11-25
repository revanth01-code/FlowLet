"use client";

import { type Step, type FilterOperator } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPERATORS: FilterOperator[] = ["eq", "neq", "gt", "lt", "contains"];
const STEP_TYPES = ["filter", "transform", "http_request"] as const;

type StepType = (typeof STEP_TYPES)[number];

function blankStep(type: StepType): Step {
  if (type === "filter") return { type: "filter", field: "", operator: "eq", value: "" };
  if (type === "transform") return { type: "transform", mapping: { "": "" } };
  return { type: "http_request", url: "", method: "POST" };
}

// ─── Sub-editors ──────────────────────────────────────────────────────────────

function FilterEditor({
  step,
  onChange,
  idPrefix,
}: {
  step: Extract<Step, { type: "filter" }>;
  onChange: (s: Step) => void;
  idPrefix: string;
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-field`}>Field (dot path)</label>
        <input
          id={`${idPrefix}-field`}
          value={step.field}
          onChange={(e) => onChange({ ...step, field: e.target.value })}
          placeholder="e.g. payload.event"
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-op`}>Operator</label>
        <select
          id={`${idPrefix}-op`}
          value={step.operator}
          onChange={(e) =>
            onChange({ ...step, operator: e.target.value as FilterOperator })
          }
        >
          {OPERATORS.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-value`}>Value</label>
        <input
          id={`${idPrefix}-value`}
          value={String(step.value)}
          onChange={(e) => onChange({ ...step, value: e.target.value })}
          placeholder='e.g. "purchase" or 42'
        />
      </div>
    </>
  );
}

function TransformEditor({
  step,
  onChange,
  idPrefix,
}: {
  step: Extract<Step, { type: "transform" }>;
  onChange: (s: Step) => void;
  idPrefix: string;
}) {
  const entries = Object.entries(step.mapping);

  const updateMapping = (newEntries: [string, string][]) => {
    const mapping: Record<string, string> = {};
    newEntries.forEach(([k, v]) => { mapping[k] = v; });
    onChange({ ...step, mapping });
  };

  return (
    <div>
      <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", fontWeight: 600 }}>
        Mapping (output field → dot path)
      </p>
      {entries.map(([key, val], i) => (
        <div key={i} className="mapping-row">
          <label htmlFor={`${idPrefix}-mk-${i}`} className="sr-only">Output field {i + 1}</label>
          <input
            id={`${idPrefix}-mk-${i}`}
            value={key}
            placeholder="outputField"
            onChange={(e) => {
              const next = [...entries] as [string, string][];
              next[i] = [e.target.value, val];
              updateMapping(next);
            }}
          />
          <span className="mapping-arrow">→</span>
          <label htmlFor={`${idPrefix}-mv-${i}`} className="sr-only">Dot path {i + 1}</label>
          <input
            id={`${idPrefix}-mv-${i}`}
            value={val}
            placeholder="dot.path"
            onChange={(e) => {
              const next = [...entries] as [string, string][];
              next[i] = [key, e.target.value];
              updateMapping(next);
            }}
          />
          <button
            type="button"
            className="btn btn-sm btn-danger"
            aria-label={`Remove mapping row ${i + 1}`}
            onClick={() => {
              const next = entries.filter((_, j) => j !== i) as [string, string][];
              updateMapping(next.length > 0 ? next : [["", ""]]);
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => updateMapping([...entries, ["", ""]] as [string, string][])}
      >
        + Add mapping
      </button>
    </div>
  );
}

function HttpRequestEditor({
  step,
  onChange,
  idPrefix,
}: {
  step: Extract<Step, { type: "http_request" }>;
  onChange: (s: Step) => void;
  idPrefix: string;
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-url`}>URL</label>
        <input
          id={`${idPrefix}-url`}
          type="url"
          value={step.url}
          onChange={(e) => onChange({ ...step, url: e.target.value })}
          placeholder="https://example.com/webhook"
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-method`}>Method</label>
        <select
          id={`${idPrefix}-method`}
          value={step.method}
          onChange={(e) =>
            onChange({ ...step, method: e.target.value as "POST" | "PUT" })
          }
        >
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
        </select>
      </div>
    </>
  );
}

// ─── Public StepEditor component ─────────────────────────────────────────────

interface StepEditorProps {
  step: Step;
  index: number;
  total: number;
  onChange: (s: Step) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function StepEditor({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const idPrefix = `step-${index}`;

  const handleTypeChange = (newType: StepType) => {
    if (newType !== step.type) onChange(blankStep(newType));
  };

  return (
    <div className="step-card">
      <div className="step-card-header">
        <span className="step-number-tag">Step {index + 1}</span>
        <label htmlFor={`${idPrefix}-type`} className="sr-only">Step type</label>
        <select
          id={`${idPrefix}-type`}
          value={step.type}
          onChange={(e) => handleTypeChange(e.target.value as StepType)}
          style={{ flex: "0 0 auto", width: "auto" }}
        >
          {STEP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="step-actions">
          <button
            type="button"
            className="btn btn-sm"
            aria-label="Move step up"
            disabled={index === 0}
            onClick={onMoveUp}
          >↑</button>
          <button
            type="button"
            className="btn btn-sm"
            aria-label="Move step down"
            disabled={index === total - 1}
            onClick={onMoveDown}
          >↓</button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            aria-label="Remove step"
            onClick={onRemove}
          >✕</button>
        </div>
      </div>

      {step.type === "filter" && (
        <FilterEditor step={step} onChange={onChange} idPrefix={idPrefix} />
      )}
      {step.type === "transform" && (
        <TransformEditor step={step} onChange={onChange} idPrefix={idPrefix} />
      )}
      {step.type === "http_request" && (
        <HttpRequestEditor step={step} onChange={onChange} idPrefix={idPrefix} />
      )}
    </div>
  );
}

// Export helper so FlowForm can create a blank step
export { blankStep };
