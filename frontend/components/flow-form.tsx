"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Flow, Step } from "@/lib/types";
import { createFlow, updateFlow, ApiError } from "@/lib/api-client";
import StepEditor, { blankStep } from "./step-editor";

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlowFormProps {
  /** When provided, the form is in edit mode; omit for create mode. */
  initialData?: Flow;
}

// ─── Client-side validation (mirrors backend constraints) ─────────────────────

interface FieldErrors {
  name?: string;
  steps?: string;
}

function validate(name: string, steps: Step[]): FieldErrors {
  const errs: FieldErrors = {};
  if (name.trim().length < 3) errs.name = "Name must be at least 3 characters.";
  if (name.trim().length > 80) errs.name = "Name must be at most 80 characters.";
  if (steps.length === 0) errs.steps = "A flow needs at least 1 step.";
  if (steps.length > 5) errs.steps = "A flow can have at most 5 steps.";
  return errs;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlowForm({ initialData }: FlowFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps ?? [blankStep("filter")]
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Step mutations ──────────────────────────────────────────────────────────

  const updateStep = useCallback((i: number, s: Step) => {
    setSteps((prev) => prev.map((x, j) => (j === i ? s : x)));
  }, []);

  const removeStep = useCallback((i: number) => {
    setSteps((prev) => prev.filter((_, j) => j !== i));
  }, []);

  const moveStep = useCallback((i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // 1. Client-side instant feedback
    const errs = validate(name, steps);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      if (isEdit && initialData) {
        // `initialData` narrowed here — TypeScript can't narrow through the
        // `isEdit` boolean alias into the async callback, so we re-check.
        await updateFlow(initialData._id, { name, description, enabled, steps });
        router.push(`/flows/${initialData._id}`);
      } else {
        const created = await createFlow({ name, description, enabled, steps });
        router.push(`/flows/${created._id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // Surface backend VALIDATION_ERROR field-level details when present
        const details = err.body.error.details;
        const fieldErrs: FieldErrors = {};
        if (typeof details["name"] === "string") fieldErrs.name = details["name"];
        if (typeof details["steps"] === "string") fieldErrs.steps = details["steps"];
        if (Object.keys(fieldErrs).length > 0) {
          setFieldErrors(fieldErrs);
        } else {
          setApiError(err.body.error.message);
        }
      } else {
        setApiError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate>
      {apiError && <div className="form-error" role="alert">{apiError}</div>}

      {/* Name */}
      <div className="form-group">
        <label htmlFor="flow-name">Name <span aria-hidden="true">*</span></label>
        <input
          id="flow-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
        {fieldErrors.name && (
          <span id="name-error" className="field-error" role="alert">
            {fieldErrors.name}
          </span>
        )}
      </div>

      {/* Description */}
      <div className="form-group">
        <label htmlFor="flow-desc">Description</label>
        <textarea
          id="flow-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Enabled */}
      <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="flow-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: "auto" }}
        />
        <label htmlFor="flow-enabled" style={{ fontWeight: "normal" }}>Enabled</label>
      </div>

      {/* Steps */}
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.9rem" }}>
        <legend style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Steps ({steps.length} / 5)
        </legend>

        {fieldErrors.steps && (
          <span className="field-error" role="alert">{fieldErrors.steps}</span>
        )}

        {steps.map((step, i) => (
          <StepEditor
            key={i}
            step={step}
            index={i}
            total={steps.length}
            onChange={(s) => updateStep(i, s)}
            onRemove={() => removeStep(i)}
            onMoveUp={() => moveStep(i, -1)}
            onMoveDown={() => moveStep(i, 1)}
          />
        ))}

        {steps.length < 5 && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setSteps((prev) => [...prev, blankStep("filter")])}
          >
            + Add step
          </button>
        )}
      </fieldset>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create flow"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
