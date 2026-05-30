import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained Node server at
  // .next/standalone/ that we can bundle as a Tauri sidecar.
  output: "standalone",
  // Next.js file tracing otherwise sucks the entire src-tauri/target/
  // (multi-GB) into the standalone bundle. Exclude noisy siblings.
  outputFileTracingExcludes: {
    "*": [
      "./src-tauri/**/*",
      "./release/**/*",
      "./.git/**/*",
      "./scripts/**/*",
    ],
  },
};

export default nextConfig;
