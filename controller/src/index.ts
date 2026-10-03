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

export interface InlineDeploymentConfig {
  name: string;
  code: string;
  env?: Record<string, string>;
}

export interface InvocationRequest {
  payload: Record<string, any>;
  env?: Record<string, string>;
}

export interface InvocationResponse {
  result?: any;
  error?: string;
  duration: number;
}

interface FunctionMetadata {
  id: string;
  name: string;
  bundlePath: string;
  deployedAt: number;
  env?: Record<string, string>;
}

export class FunctionController {
  private deployments: Map<string, FunctionMetadata> = new Map();
  private deploymentDir: string;
  private registryPath: string;

  constructor(deploymentDir?: string) {
    this.deploymentDir = deploymentDir || path.join(os.tmpdir(), "fc-deployments");
    this.registryPath = path.join(this.deploymentDir, "registry.json");

    if (!fs.existsSync(this.deploymentDir)) {
      fs.mkdirSync(this.deploymentDir, { recursive: true });
    }

    this.loadRegistry();
  }

  private loadRegistry(): void {
    if (fs.existsSync(this.registryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.registryPath, "utf-8"));
        this.deployments = new Map(
          Object.entries(data).map(([key, value]: [string, any]) => [
            key,
            {
              id: value.id || key,
              name: value.name,
              bundlePath: value.bundlePath || value,
              deployedAt: value.deployedAt || Date.now(),
              env: value.env,
            },
          ])
        );
      } catch (error) {
        console.warn("Failed to load registry, starting fresh");
      }
    }
  }

  private saveRegistry(): void {
    const data = Object.fromEntries(
      Array.from(this.deployments.entries()).map(([key, value]) => [
        key,
        {
          id: value.id,
          name: value.name,
          bundlePath: value.bundlePath,
          deployedAt: value.deployedAt,
          env: value.env,
        },
      ])
    );
    fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
  }

  async deploy(config: DeploymentConfig): Promise<string> {
    const bundleName = `${config.name}-${Date.now()}.js`;
    const bundlePath = path.join(this.deploymentDir, bundleName);

    console.log(`📦 Deploying ${config.name}...`);

    await bundleFunction({
      entryPoint: path.resolve(config.sourceFile),
      outfile: bundlePath,
    });

    const metadata: FunctionMetadata = {
      id: config.name,
      name: config.name,
      bundlePath,
      deployedAt: Date.now(),
    };

    this.deployments.set(config.name, metadata);
    this.saveRegistry();
    console.log(`✅ Deployed ${config.name}`);

    return bundlePath;
  }

  async deployInline(config: InlineDeploymentConfig): Promise<string> {
    const bundleName = `${config.name}-${Date.now()}.js`;
    const bundlePath = path.join(this.deploymentDir, bundleName);
    const wrappedCode = `
import { defineHandler } from "@firecracker-lambda/framework";
${config.code}
`;

    console.log(`📦 Deploying ${config.name}...`);

    // Write code to temp file and bundle it
    const tempFile = path.join(this.deploymentDir, `${config.name}-${Date.now()}.ts`);
    fs.writeFileSync(tempFile, wrappedCode);

    try {
      await bundleFunction({
        entryPoint: tempFile,
        outfile: bundlePath,
      });

      const metadata: FunctionMetadata = {
        id: config.name,
        name: config.name,
        bundlePath,
        deployedAt: Date.now(),
        env: config.env,
      };

      this.deployments.set(config.name, metadata);
      this.saveRegistry();
      console.log(`✅ Deployed ${config.name}`);

      return config.name;
    } finally {
      fs.unlinkSync(tempFile);
    }
  }

  delete(functionId: string): void {
    const metadata = this.deployments.get(functionId);
    if (metadata && fs.existsSync(metadata.bundlePath)) {
      fs.unlinkSync(metadata.bundlePath);
    }
    this.deployments.delete(functionId);
    this.saveRegistry();
    console.log(`🗑️  Deleted ${functionId}`);
  }

  async invoke(
    functionName: string,
    request: InvocationRequest
  ): Promise<InvocationResponse> {
    const metadata = this.deployments.get(functionName);

    if (!metadata) {
      return {
        error: `Function '${functionName}' not deployed`,
        duration: 0,
      };
    }

    if (!fs.existsSync(metadata.bundlePath)) {
      return {
        error: `Function bundle not found: ${metadata.bundlePath}`,
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

      const payload = {
        ...request.payload,
        __env: { ...metadata.env, ...request.env },
      };

      const result = await vm.execute(metadata.bundlePath, payload);

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

  list(): FunctionMetadata[] {
    return Array.from(this.deployments.values());
  }
}

export { FirecrackerVM };
