import * as http from "http";
import * as url from "url";
import * as fs from "fs";
import * as path from "path";
import { FunctionController } from "./index";
import { SimpleMetricsCollector } from "./simple-metrics";

interface ApiRequest {
  method: string;
  pathname: string;
  query: Record<string, string>;
  body: string;
}

interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export class APIServer {
  private controller: FunctionController;
  private server: http.Server;
  private port: number;
  private metrics: SimpleMetricsCollector;

  constructor(port: number = 3000, deploymentDir?: string) {
    this.port = port;
    this.controller = new FunctionController(deploymentDir);
    this.metrics = new SimpleMetricsCollector();
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const parsedUrl = url.parse(req.url || "", true);
    const pathname = parsedUrl.pathname || "/";
    const query = (parsedUrl.query || {}) as Record<string, string>;

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const response = await this.route({
          method: req.method || "GET",
          pathname,
          query,
          body,
        });

        res.writeHead(response.statusCode, response.headers);
        res.end(response.body);
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Internal error",
          })
        );
      }
    });
  }

  private async route(req: ApiRequest): Promise<ApiResponse> {
    const { method, pathname } = req;

    // Dashboard: GET /
    if (method === "GET" && pathname === "/") {
      try {
        const dashboardPath = path.join(__dirname, "dashboard.html");
        const html = fs.readFileSync(dashboardPath, "utf-8");
        return {
          statusCode: 200,
          headers: { "Content-Type": "text/html" },
          body: html,
        };
      } catch {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Firecracker Lambda API",
            version: "0.1.0",
            message: "Dashboard not available",
          }),
        };
      }
    }

    // Deploy function: POST /api/functions/deploy
    if (method === "POST" && pathname === "/api/functions/deploy") {
      try {
        const body = JSON.parse(req.body);
        const { name, code, env } = body as {
          name: string;
          code: string;
          env?: Record<string, string>;
        };

        if (!name || !code) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Missing name or code" }),
          };
        }

        const functionId = await this.controller.deployInline({
          name,
          code,
          env: env || {},
        });

        return {
          statusCode: 201,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            functionId,
            name,
            message: `Deployed ${name}`,
          }),
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Deploy failed",
          }),
        };
      }
    }

    // List functions: GET /api/functions
    if (method === "GET" && pathname === "/api/functions") {
      const functions = this.controller.list();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          functions.map((fn) => ({
            id: fn.id || fn.name,
            name: fn.name || fn.id,
            deployedAt: fn.deployedAt,
          }))
        ),
      };
    }

    // Delete function: DELETE /api/functions/:id
    if (method === "DELETE" && pathname.startsWith("/api/functions/")) {
      const id = pathname.replace("/api/functions/", "");
      try {
        this.controller.delete(id);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Deleted" }),
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Delete failed",
          }),
        };
      }
    }

    // Invoke function: POST /api/invoke/:name
    if (method === "POST" && pathname.startsWith("/api/invoke/")) {
      const name = pathname.replace("/api/invoke/", "");

      try {
        const startTime = Date.now();
        const body = JSON.parse(req.body);
        const { payload, env } = body as {
          payload: any;
          env?: Record<string, string>;
        };

        const result = await this.controller.invoke(name, {
          payload,
          env: env || {},
        });

        const duration = Date.now() - startTime;

        this.metrics.recordMetric({
          functionId: name,
          invocationId: `inv-${Date.now()}`,
          duration,
          timestamp: Date.now(),
          status: result.error ? "error" : "success",
          coldStart: false,
          errorMessage: result.error,
        });

        const statusCode = result.error ? 400 : 200;
        return {
          statusCode,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result),
        };
      } catch (error) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Invoke failed",
          }),
        };
      }
    }

    // Get metrics: GET /api/metrics/functions/:id/stats
    if (method === "GET" && pathname.startsWith("/api/metrics/functions/")) {
      const parts = pathname.split("/");
      const functionId = parts[4];

      if (pathname.includes("/stats")) {
        const stats = this.metrics.getQuickStats(functionId);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            functionId,
            timestamp: Date.now(),
            stats,
          }),
        };
      }
    }

    // Health check: GET /api/health
    if (method === "GET" && pathname === "/api/health") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Not found",
        pathname,
      }),
    };
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🚀 Firecracker Lambda API listening on http://localhost:${this.port}`);
        console.log(`   GET  http://localhost:${this.port}/                              (Dashboard)`);
        console.log(`   GET  http://localhost:${this.port}/api/health                   (Health check)`);
        console.log(`   GET  http://localhost:${this.port}/api/functions                (List functions)`);
        console.log(`   POST http://localhost:${this.port}/api/functions/deploy         (Deploy function)`);
        console.log(`   POST http://localhost:${this.port}/api/invoke/:name             (Invoke function)`);
        console.log(`   GET  http://localhost:${this.port}/api/metrics/functions/:id/stats (Metrics)`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log("Server stopped");
        resolve();
      });
    });
  }
}
