import { FunctionRequest, FunctionResponse, invoke, Handler } from "@firecracker-lambda/framework";
import * as fs from "fs";
import * as path from "path";

interface ExitResponse {
  status: "success" | "error";
  code: number;
}

async function executeFunction(
  functionBundle: string,
  request: FunctionRequest
): Promise<FunctionResponse | ExitResponse> {
  try {
    const bundleCode = fs.readFileSync(functionBundle, "utf-8");
    const module: { handler?: Handler; default?: Handler } = {};

    const script = `
      (function() {
        const exports = {};
        const module = { exports };
        const require = (id) => {
          throw new Error('require() not supported in bundled function: ' + id);
        };

        ${bundleCode}

        return module.exports || exports;
      })()
    `;

    const fn = eval(script) as any;
    const handler: Handler = fn.handler || fn.default;

    if (!handler || typeof handler !== "function") {
      return {
        id: request.id,
        error: "No handler or default export found",
        duration: 0,
      };
    }

    return await invoke(handler, request);
  } catch (error) {
    return {
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: runtime <function-bundle> <request-json>");
    process.exit(1);
  }

  const [bundlePath, requestJson] = args;

  try {
    const request: FunctionRequest = JSON.parse(requestJson);
    const response = await executeFunction(bundlePath, request);

    console.log(JSON.stringify(response));

    if ("error" in response && response.error) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })
    );
    process.exit(1);
  }
}

main();
