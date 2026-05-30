import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

const CONFIG_PATH = path.join(homedir(), ".coven", "cave-config.json");
const STATE_PATH = path.join(homedir(), ".coven", "cave-state.json");

const DEFAULT_CONFIG: CaveConfig = {
  version: 1,
  defaults: { harness: "codex", model: "openai/gpt-5.5" },
  familiars: {},
};

const DEFAULT_STATE: CaveState = { sessionFamiliar: {} };

export type FamiliarBinding = {
  harness: string;
  model: string;
  note?: string;
};

export type CaveConfig = {
  version: number;
  defaults: FamiliarBinding;
  familiars: Record<string, Partial<FamiliarBinding>>;
};

export type CaveState = {
  sessionFamiliar: Record<string, string>;
};

export async function loadConfig(): Promise<CaveConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<CaveConfig>;
    return {
      version: parsed.version ?? 1,
      defaults: { ...DEFAULT_CONFIG.defaults, ...(parsed.defaults ?? {}) },
      familiars: parsed.familiars ?? {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function bindingFor(config: CaveConfig, familiarId: string): FamiliarBinding {
  const f = config.familiars[familiarId] ?? {};
  return {
    harness: f.harness ?? config.defaults.harness,
    model: f.model ?? config.defaults.model,
    note: f.note,
  };
}

export async function loadState(): Promise<CaveState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<CaveState>;
    return { sessionFamiliar: parsed.sessionFamiliar ?? {} };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function recordSessionFamiliar(sessionId: string, familiarId: string): Promise<void> {
  const state = await loadState();
  state.sessionFamiliar[sessionId] = familiarId;
  try {
    await mkdir(path.dirname(STATE_PATH), { recursive: true });
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* best effort */
  }
}
