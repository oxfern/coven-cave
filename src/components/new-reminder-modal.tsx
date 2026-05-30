"use client";

import { useEffect, useMemo, useState } from "react";
import type { Familiar } from "@/lib/types";
import { parseWhen, splitWhenAndText } from "@/lib/parse-when";

export type NewReminderDraft = {
  title: string;
  body?: string;
  fireAt: string;
  familiarId: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  familiars: Familiar[];
  defaultFamiliarId?: string | null;
  defaultWhenText?: string;
  defaultTitle?: string;
  onCreate: (draft: NewReminderDraft) => Promise<void> | void;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function NewReminderModal({
  open,
  onClose,
  familiars,
  defaultFamiliarId = null,
  defaultWhenText = "",
  defaultTitle = "",
  onCreate,
}: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const [whenText, setWhenText] = useState(defaultWhenText);
  const [manualFireAt, setManualFireAt] = useState<string>("");
  const [familiarId, setFamiliarId] = useState<string | null>(defaultFamiliarId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setWhenText(defaultWhenText);
    setManualFireAt("");
    setFamiliarId(defaultFamiliarId);
    setError(null);
  }, [open, defaultFamiliarId, defaultWhenText, defaultTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const parsed = useMemo(() => {
    const w = whenText.trim();
    if (!w) return null;
    return parseWhen(w);
  }, [whenText]);

  const resolvedFireAt = useMemo<string | null>(() => {
    if (manualFireAt) {
      const t = new Date(manualFireAt).getTime();
      return Number.isFinite(t) ? new Date(t).toISOString() : null;
    }
    if (parsed) return parsed.fireAt;
    return null;
  }, [manualFireAt, parsed]);

  if (!open) return null;

  const create = async () => {
    if (!title.trim() || !resolvedFireAt || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        fireAt: resolvedFireAt,
        familiarId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "create failed");
    } finally {
      setBusy(false);
    }
  };

  const previewLabel = resolvedFireAt
    ? new Date(resolvedFireAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">New reminder</h2>
            <p className="text-[12px] text-zinc-500">
              Type a natural phrase like “in 30m” or pick a date.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded border border-zinc-800 text-zinc-400 hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        <Field label="Remind me to">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="check the deploy"
            autoFocus
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-purple-600"
          />
        </Field>

        <Field label="When">
          <input
            value={whenText}
            onChange={(e) => {
              setWhenText(e.target.value);
              if (e.target.value.trim()) setManualFireAt("");
            }}
            placeholder="in 30m · in 2h · today 17:30 · tomorrow 9am"
            className={`w-full rounded-md border bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 ${
              whenText && !parsed
                ? "border-amber-600/60"
                : "border-zinc-800 focus:border-purple-600"
            }`}
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
            <span>
              {whenText && !parsed
                ? "Couldn't parse — try “in 30m”, “today 9pm”, or use the picker below."
                : parsed
                ? `Parsed → ${previewLabel}`
                : "Or pick exactly:"}
            </span>
          </div>
        </Field>

        <Field label="Exact date / time">
          <input
            type="datetime-local"
            value={manualFireAt}
            onChange={(e) => {
              setManualFireAt(e.target.value);
              if (e.target.value) setWhenText("");
            }}
            min={toLocalInput(new Date().toISOString())}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-600"
          />
        </Field>

        <Field label="Familiar">
          <Select
            value={familiarId ?? ""}
            onChange={(v) => setFamiliarId(v || null)}
            options={[
              { value: "", label: "No familiar" },
              ...familiars.map((f) => ({
                value: f.id,
                label: `${f.display_name} · ${f.harness ?? "?"}`,
              })),
            ]}
          />
        </Field>

        {error ? (
          <div className="mb-3 rounded border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-xs text-amber-200">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={create}
            disabled={!title.trim() || !resolvedFireAt || busy}
            className="rounded-md bg-rose-700 px-4 py-1.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? "Creating…" : previewLabel ? `Remind ${previewLabel}` : "Create"}
          </button>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 pr-8 text-sm text-zinc-100 outline-none focus:border-purple-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
        ▾
      </span>
    </div>
  );
}

/**
 * Helper to map a "/remind …" args string into modal defaults — used by the
 * palette/slash handler to pre-fill the modal with the parsed body.
 */
export function draftFromSlashArgs(args: string): {
  title: string;
  whenText: string;
} {
  const trimmed = args.trim();
  const { when, text } = splitWhenAndText(trimmed);
  if (!when) return { title: trimmed, whenText: "" };
  // text is the trailing slice; whenText is whatever leads up to it.
  const whenText = text ? trimmed.slice(0, trimmed.length - text.length).trim() : trimmed;
  return { title: text, whenText };
}
