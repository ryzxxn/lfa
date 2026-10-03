export interface FunctionRequest {
  id: string;
  payload: Record<string, any>;
  timeout?: number;
}

export interface FunctionResponse {
  id: string;
  result?: any;
  error?: string;
  duration: number;
}

export type Handler = (payload: Record<string, any>) => Promise<any>;

let _currentPayload: Record<string, any> = {};

export function defineHandler(handler: Handler): Handler {
  return async (payload: Record<string, any>) => {
    _currentPayload = payload;
    return handler(payload);
  };
}

/**
 * Get environment variables injected during invocation
 * Usage: const apiKey = getEnv("API_KEY")
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const env = _currentPayload?.__env || process.env;
  return env[key] || defaultValue;
}

export async function invoke(
  handler: Handler,
  request: FunctionRequest
): Promise<FunctionResponse> {
  const start = Date.now();
  try {
    const result = await handler(request.payload);
    return {
      id: request.id,
      result,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// Lazy loading for external modules
export { lazyLoad, lazyLoadMultiple, clearModuleCache, declareExternalModules } from "./lazy-loader";
export type { ModuleMetadata } from "./lazy-loader";
