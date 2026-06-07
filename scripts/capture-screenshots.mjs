// Drive a headed Chromium against http://localhost:3000 and capture
// each of the README-referenced screenshots. Requires the dev server
// to already be running with NEXT_PUBLIC_DEMO=true so sidebar + sample
// activity are populated.
//
// Run: node scripts/capture-screenshots.mjs

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "screenshots");

// Logical viewport for marketing-clean shots. Playwright captures at the
// configured deviceScaleFactor, so 2 gives a 2× retina export.
const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;

const CAPTURES = [
  { file: "home.png",     label: "HomeComposer cold-start", click: "Home" },
  { file: "shell.png",    label: "Three-pane shell + chat", click: "Familiars" },
  { file: "chat.png",     label: "Chat view (same as shell — falls back to chat)", click: "Familiars" },
  { file: "board.png",    label: "Board view",              click: "Tasks" },
  { file: "library.png",  label: "Library",                 click: "Library" },
  { file: "calendar.png", label: "Calendar (week view)",    click: "Calendar" },
  { file: "terminal.png", label: "Bottom terminal",         click: "Terminal" },
  { file: "floor.png",    label: "Coven Floor",             click: "Familiars" /* with floor sub-tab */ },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (err) => console.warn("[pageerror]", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.warn("[console.error]", msg.text());
  });

  // Intercept the onboarding-status endpoint so the setup overlay doesn't
  // mount over the views we want to capture. With no `coven` daemon
  // running, the real endpoint reports daemon/familiars/binding as missing
  // and the overlay blocks the entire workspace.
  await ctx.route("**/api/onboarding/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        complete: true,
        steps: {
          covenCli: { ok: true, detail: "/usr/local/bin/coven" },
          covenHome: { ok: true, detail: "~/.coven" },
          adapters: { ok: true, detail: "Codex, Claude Code" },
          daemon: { ok: true },
          familiars: { ok: true },
          binding: { ok: true },
        },
      }),
    });
  });

  console.log("→ navigating to http://localhost:3000");
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Allow client hydration + initial data fetch.
  await page.waitForTimeout(3500);

  // If the overlay still mounted before our intercept took effect, click
  // its "Open Cave" / dismiss button.
  const openCave = page.getByRole("button", { name: /open cave/i }).first();
  if (await openCave.count()) {
    await openCave.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  for (const cap of CAPTURES) {
    console.log(`→ ${cap.file} (${cap.label})`);
    try {
      // Click the sidebar item for this mode.
      const btn = page.getByRole("button", { name: cap.click, exact: true }).first();
      const hit = await btn.count();
      if (hit > 0) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
      } else {
        console.warn(`  no sidebar button "${cap.click}" — capturing current state`);
      }

      // Surface-specific tweaks
      if (cap.file === "floor.png") {
        // CovenFloor lives as a tab inside the agents view — rendered as a
        // <button> with text "Floor".
        const floorTab = page.getByRole("button", { name: "Floor", exact: true }).first();
        if (await floorTab.count()) {
          await floorTab.click().catch(() => {});
          await page.waitForTimeout(800);
        } else {
          console.warn("  no Floor tab found");
        }
      }
      if (cap.file === "chat.png") {
        // After landing on Familiars (Chats tab is the default), click the
        // first chat row in the center list so the right pane shows a
        // real conversation thread.
        const firstChat = page.locator("main button, [role='main'] button, table tbody tr")
          .filter({ hasText: /update to|enable adding|hello|Patch|Task chat/i })
          .first();
        if (await firstChat.count()) {
          await firstChat.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1200);
        } else {
          console.warn("  no chat row matched");
        }
      }

      await page.screenshot({
        path: resolve(OUT, cap.file),
        fullPage: false,
        type: "png",
        animations: "disabled",
      });
      console.log(`  ✓ ${cap.file}`);
    } catch (err) {
      console.error(`  ✗ ${cap.file}: ${err.message}`);
    }
  }

  await browser.close();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
