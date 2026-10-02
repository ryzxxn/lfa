#!/usr/bin/env node

import { FunctionController } from "./index";
import * as path from "path";
import * as fs from "fs";

const controller = new FunctionController();

async function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case "deploy": {
        if (args.length < 2) {
          console.error("Usage: firecracker-lambda deploy <name> <file>");
          process.exit(1);
        }
        const [name, file] = args;
        await controller.deploy({
          name,
          sourceFile: file,
        });
        break;
      }

      case "invoke": {
        if (args.length < 2) {
          console.error(
            "Usage: firecracker-lambda invoke <name> <payload-json>"
          );
          process.exit(1);
        }
        const [name, payloadStr] = args;
        const payload = JSON.parse(payloadStr);
        const response = await controller.invoke(name, { payload });
        console.log(JSON.stringify(response, null, 2));
        break;
      }

      case "list": {
        const functions = controller.list();
        if (functions.length === 0) {
          console.log("No functions deployed");
        } else {
          console.log("Deployed functions:");
          functions.forEach((fn) => console.log(`  - ${fn}`));
        }
        break;
      }

      case "--help":
      case "-h":
      case "help": {
        console.log(`
Firecracker Lambda - Self-managed serverless runtime

Commands:
  deploy <name> <file>           Deploy a function
  invoke <name> <payload-json>   Invoke a deployed function
  list                           List deployed functions
  help                           Show this help message

Example:
  firecracker-lambda deploy hello examples/hello.ts
  firecracker-lambda invoke hello '{"name":"world"}'
`);
        break;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        console.error("Use 'firecracker-lambda help' for usage information");
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
