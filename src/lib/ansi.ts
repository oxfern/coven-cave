const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const OSC_RE = /\x1B\][^\x07]*(?:\x07|\x1B\\)/g;

export function stripAnsi(input: string): string {
  return input.replace(OSC_RE, "").replace(ANSI_RE, "");
}

const PROMPT_PATTERNS: RegExp[] = [
  /\?\s*$/,
  /\?\s*\([^)]*\)\s*$/,
  /press\s+enter\b/i,
  /\[y\/n\]\s*$/i,
  /\(y\/n\)\s*$/i,
  /›\s*$/,
  />\s*$/,
  /:\s*$/,
];

export function needsResponse(stripped: string): boolean {
  const tail = stripped.replace(/\s+$/, "").slice(-400);
  if (!tail) return false;
  return PROMPT_PATTERNS.some((re) => re.test(tail));
}
