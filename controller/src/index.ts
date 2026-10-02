import { FirecrackerVM } from "./vm";
import { bundleFunction } from "@firecracker-lambda/bundler";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export interface DeploymentConfig {
  name: string;
  sourceFile: string;
  timeout?: number;
}

export interface InvocationRequest {
  payload: Record<string, any>;
}

export interface InvocationResponse {
  result?: any;
  error?: string;
  duration: number;
}

export class FunctionController {
  private deployments: Map<string, string> = new Map();
  private deploymentDir: string;

  constructor(deploymentDir?: string) {
    this.deploymentDir = deploymentDir || path.join(os.tmpdir(), "fc-deployments");
    if (!fs.existsSync(this.deploymentDir)) {
      fs.mkdirSync(this.deploymentDir, { recursive: true });
    }
  }

  async deploy(config: DeploymentConfig): Promise<string> {
    const bundleName = `${config.name}-${Date.now()}.js`;
    const bundlePath = path.join(this.deploymentDir, bundleName);

    console.log(`📦 Deploying ${config.name}...`);

    await bundleFunction({
      entryPoint: path.resolve(config.sourceFile),
      outfile: bundlePath,
    });

    this.deployments.set(config.name, bundlePath);
    console.log(`✅ Deployed ${config.name}`);

    return bundlePath;
  }

  async invoke(
    functionName: string,
    request: InvocationRequest
  ): Promise<InvocationResponse> {
    const bundlePath = this.deployments.get(functionName);

    if (!bundlePath) {
      return {
        error: `Function '${functionName}' not deployed`,
        duration: 0,
      };
    }

    if (!fs.existsSync(bundlePath)) {
      return {
        error: `Function bundle not found: ${bundlePath}`,
        duration: 0,
      };
    }

    const start = Date.now();
    const vm = new FirecrackerVM({
      kernelImage: "",
      rootfs: "",
    });

    try {
      console.log(`🚀 Invoking ${functionName}...`);
      const result = await vm.execute(bundlePath, request.payload);

      if (result.exitCode !== 0) {
        return {
          error: result.stderr || "Function execution failed",
          duration: Date.now() - start,
        };
      }

      try {
        const response = JSON.parse(result.stdout);
        return {
          result: response.result,
          error: response.error,
          duration: Date.now() - start,
        };
      } catch {
        return {
          result: result.stdout,
          duration: Date.now() - start,
        };
      }
    } finally {
      vm.cleanup();
    }
  }

  list(): string[] {
    return Array.from(this.deployments.keys());
  }
}

export { FirecrackerVM };
