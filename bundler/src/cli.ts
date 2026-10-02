#!/usr/bin/env node

import { bundleFunction } from "./bundler";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage: bundle-function <entrypoint> [options]

Options:
  --out, -o         Output file (default: dist/function.js)
  --help            Show this help message
`);
    process.exit(args.includes("--help") ? 0 : 1);
  }

  const entryPoint = path.resolve(args[0]);
  let outfile = "dist/function.js";

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === "--out" || args[i] === "-o") && args[i + 1]) {
      outfile = args[++i];
    }
  }

  try {
    await bundleFunction({
      entryPoint,
      outfile: path.resolve(outfile),
    });
  } catch (error) {
    console.error(
      "Bundle failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main();
