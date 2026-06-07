import { chromium } from "playwright";

const out = process.argv[2] ?? "/tmp/board-inspector.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1100, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("[console.error] " + m.text());
});

await page.goto("http://localhost:3000/preview/board-inspector", { waitUntil: "networkidle" });
await page.waitForSelector(".board-drawer", { timeout: 15000 });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: false });

console.log("OK", out);
if (errors.length) {
  console.log("---errors---");
  for (const e of errors) console.log(e);
}
await browser.close();
