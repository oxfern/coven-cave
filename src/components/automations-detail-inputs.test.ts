// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./automations-view.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /function splitAutomationPrompt/,
  "Automation detail should split the stored prompt into editable sections",
);

assert.match(
  source,
  /function composeAutomationPrompt/,
  "Automation detail should compose distinct inputs back into the prompt payload",
);

assert.match(source, /<FieldLabel>Goals<\/FieldLabel>/, "Automation detail should show a Goals input");
assert.match(
  source,
  /<FieldLabel>Deliverables<\/FieldLabel>/,
  "Automation detail should show a Deliverables input",
);

assert.doesNotMatch(
  source,
  /<FieldLabel>Prompt<\/FieldLabel>/,
  "Automation detail should not collapse goals and deliverables into one Prompt input",
);

assert.match(
  source,
  /prompt:\s*nextPrompt/,
  "Automation save should persist the composed goals and deliverables prompt",
);
