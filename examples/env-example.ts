import { defineHandler, getEnv } from "@firecracker-lambda/framework";

/**
 * Example function demonstrating environment variable usage
 *
 * Deploy with env vars:
 * {
 *   name: "env-example",
 *   code: "...",
 *   env: {
 *     "API_KEY": "secret123",
 *     "API_URL": "https://api.example.com"
 *   }
 * }
 *
 * Invoke with additional env vars:
 * POST /api/invoke/env-example
 * {
 *   "payload": { "action": "test" },
 *   "env": { "DEBUG": "true" }
 * }
 */

export default defineHandler(async (payload: {
  action: string;
  database?: string;
}) => {
  // Get environment variables
  const apiKey = getEnv("API_KEY");
  const apiUrl = getEnv("API_URL");
  const debug = getEnv("DEBUG") === "true";
  const dbHost = getEnv("DB_HOST", "localhost");

  if (debug) {
    console.log("[DEBUG] Action:", payload.action);
    console.log("[DEBUG] DB Host:", dbHost);
  }

  // Simulate making an API call with the environment variables
  const result = {
    action: payload.action,
    timestamp: new Date().toISOString(),
    config: {
      apiUrl,
      dbHost,
      hasApiKey: !!apiKey,
      debug,
    },
  };

  if (payload.action === "get-secret") {
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set");
    }
    return {
      ...result,
      message: "API key is configured",
    };
  }

  if (payload.action === "check-db") {
    return {
      ...result,
      message: `Database configured at ${dbHost}`,
    };
  }

  return {
    ...result,
    message: "Environment example function executed",
    allEnvVars: {
      API_URL: apiUrl,
      DB_HOST: dbHost,
      DEBUG: debug,
    },
  };
});
