import { describe, expect, test } from "bun:test";
import { covenHelpSupportsAdapterList } from "../../../src/lib/harness-adapters.ts";
import { optionValue, rootHelpText, scenarioFrom } from "../runtimes/protocol.ts";

describe("runtime-double protocol", () => {
  test("extracts scenario markers from prompts", () => {
    expect(scenarioFrom("please run [qa:resume-recovery] now")).toBe("resume-recovery");
    expect(scenarioFrom("ordinary prompt")).toBe("chat-round-trip");
  });

  test("reads process option values", () => {
    expect(optionValue(["run", "codex", "--model", "qa/model"], "--model")).toBe("qa/model");
    expect(optionValue(["run", "codex"], "--model")).toBeNull();
  });

  test("advertises the adapter inventory command", () => {
    expect(covenHelpSupportsAdapterList(rootHelpText())).toBe(true);
  });
});
