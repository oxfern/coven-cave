export type ChatResponseMetadata = {
  familiarId: string;
  harness: string;
  model: string;
  runtime: string;
};

export function modelLabel(model?: string | null): string | null {
  const trimmed = model?.trim();
  return trimmed ? `model: ${trimmed}` : null;
}

export function runtimeLabel(runtime?: string | null): string | null {
  const trimmed = runtime?.trim();
  return trimmed ? `runtime: ${trimmed}` : null;
}
