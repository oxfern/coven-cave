export type RuntimeState = {
  appUrl: string;
  caveHome: string;
  covenHome: string;
  display: string;
  geometry: string;
  home: string;
  realCovenBin: string;
  xauthority: string;
};

export type ScenarioSpec = {
  id: string;
  number: number;
  title: string;
  passHoldMs?: number;
  preRollMs?: number;
  showRunning?: boolean;
};

export type ScenarioEvidence = {
  assertions: string[];
  summary: string;
};

export type ScenarioResult = ScenarioSpec & ScenarioEvidence & {
  finishedAt: string;
  startedAt: string;
  status: "passed" | "failed";
  video: string | null;
};

export type StreamEvent = {
  id?: string;
  isError?: boolean;
  kind?: string;
  responseMetadata?: Record<string, unknown>;
  sessionId?: string;
  status?: string;
  text?: string;
};

export type ChatResponse = {
  body?: Record<string, any>;
  events: StreamEvent[];
  raw?: string;
  status: number;
};

export type FamiliarInput = Record<string, unknown> & { id: string };
