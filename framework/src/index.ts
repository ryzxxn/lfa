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

export function defineHandler(handler: Handler): Handler {
  return handler;
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
