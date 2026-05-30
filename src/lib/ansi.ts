const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const OSC_RE = /\x1B\][^\x07]*(?:\x07|\x1B\\)/g;

export function stripAnsi(input: string): string {
  return input.replace(OSC_RE, "").replace(ANSI_RE, "");
}
