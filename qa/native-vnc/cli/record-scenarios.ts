#!/usr/bin/env bun

import { ScenarioContext } from "../scenarios/context.ts";
import { runScenarioCases } from "../scenarios/cases.ts";

const label = "[qa:native-vnc:scenarios]";
const context = await ScenarioContext.create();

try {
  await runScenarioCases(context);
} finally {
  await context.close();
}

const failed = context.results.filter((result) => result.status !== "passed");
console.log(`${label} ${context.results.length - failed.length}/${context.results.length} scenarios passed`);
console.log(`${label} manifest: ${context.manifestPath}`);
if (context.recordVideos) console.log(`${label} videos: ${context.videosDir}`);
for (const failure of failed) console.error(`${label} FAIL ${failure.id}: ${failure.summary}`);
if (failed.length > 0) process.exitCode = 1;
