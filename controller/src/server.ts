import * as http from "http";
import * as url from "url";
import { FunctionController } from "./index";

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

  constructor(port: number = 3000, deploymentDir?: string) {
    this.port = port;
    this.controller = new FunctionController(deploymentDir);
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

    // Deploy function: POST /deploy
    if (method === "POST" && pathname === "/deploy") {
      try {
        const body = JSON.parse(req.body);
        const { name, source } = body as { name: string; source: string };

        if (!name || !source) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Missing name or source" }),
          };
        }

        const bundlePath = await this.controller.deploy({
          name,
          sourceFile: source,
        });

        return {
          statusCode: 201,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            bundlePath,
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

    // Invoke function: POST /invoke/:name
    if (method === "POST" && pathname.startsWith("/invoke/")) {
      const name = pathname.replace("/invoke/", "");

      try {
        const payload = req.body ? JSON.parse(req.body) : {};
        const response = await this.controller.invoke(name, { payload });

        const statusCode = response.error ? 400 : 200;
        return {
          statusCode,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
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

    // List functions: GET /list
    if (method === "GET" && pathname === "/list") {
      const functions = this.controller.list();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functions,
          count: functions.length,
        }),
      };
    }

    // Health check: GET /health
    if (method === "GET" && pathname === "/health") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // API docs: GET /
    if (method === "GET" && pathname === "/") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Firecracker Lambda API",
          version: "0.1.0",
          endpoints: {
            "GET /": "This help message",
            "GET /health": "Health check",
            "GET /list": "List deployed functions",
            "POST /deploy": "Deploy a function (body: {name, source})",
            "POST /invoke/:name": "Invoke a function (body: payload)",
          },
          examples: {
            deploy: {
              method: "POST",
              url: "http://localhost:3000/deploy",
              body: {
                name: "hello",
                source: "/path/to/hello.ts",
              },
            },
            invoke: {
              method: "POST",
              url: "http://localhost:3000/invoke/hello",
              body: { name: "World" },
            },
          },
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
        console.log(`   GET  http://localhost:${this.port}/           (API docs)`);
        console.log(`   GET  http://localhost:${this.port}/health     (Health check)`);
        console.log(`   GET  http://localhost:${this.port}/list       (List functions)`);
        console.log(`   POST http://localhost:${this.port}/deploy     (Deploy function)`);
        console.log(`   POST http://localhost:${this.port}/invoke/:name (Invoke function)`);
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
