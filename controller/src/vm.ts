import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export interface VMConfig {
  vcpuCount?: number;
  memMB?: number;
  kernelImage?: string;
  rootfs?: string;
  workDir?: string;
  useFirecracker?: boolean;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class FirecrackerVM {
  private config: VMConfig;
  private process?: ChildProcess;
  private workDir: string;
  private socketPath: string;
  private useFirecracker: boolean;

  constructor(config: VMConfig) {
    this.config = {
      vcpuCount: 1,
      memMB: 128,
      useFirecracker: false,
      ...config,
    };
    this.useFirecracker = config.useFirecracker ?? false;
    this.workDir = config.workDir || path.join(os.tmpdir(), `fc-${Date.now()}`);
    this.socketPath = path.join(this.workDir, "firecracker.sock");

    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }
  }

  async execute(
    bundlePath: string,
    request: Record<string, any>
  ): Promise<ExecutionResult> {
    if (this.useFirecracker && this.config.kernelImage) {
      return this.executeWithFirecracker(bundlePath, request);
    }
    return this.executeWithNode(bundlePath, request);
  }

  private executeWithNode(
    bundlePath: string,
    request: Record<string, any>
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const requestJson = JSON.stringify({
        id: `req-${Date.now()}`,
        payload: request,
      });

      const nodeProcess = spawn(
        "node",
        [
          path.join(__dirname, "../../../runtime/dist/index.js"),
          bundlePath,
          requestJson,
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 30000,
        }
      );

      let stdout = "";
      let stderr = "";

      nodeProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      nodeProcess.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      nodeProcess.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      nodeProcess.on("error", (error) => {
        reject(error);
      });

      nodeProcess.stdin?.write("");
      nodeProcess.stdin?.end();
    });
  }

  private async executeWithFirecracker(
    bundlePath: string,
    request: Record<string, any>
  ): Promise<ExecutionResult> {
    try {
      const { FirecrackerVMManager } = await import(
        "@firecracker-lambda/firecracker"
      );

      const vmManager = new FirecrackerVMManager({
        vcpuCount: this.config.vcpuCount,
        memMB: this.config.memMB,
        kernelPath: this.config.kernelImage!,
        rootfsPath: this.config.rootfs,
      });

      try {
        await vmManager.initialize();
        const result = await vmManager.execute({
          bundlePath,
          payload: request,
        });
        return result;
      } finally {
        await vmManager.cleanup();
      }
    } catch (error) {
      return {
        stdout: "",
        stderr:
          error instanceof Error
            ? error.message
            : "Firecracker execution failed",
        exitCode: 1,
      };
    }
  }

  cleanup(): void {
    if (this.process) {
      this.process.kill();
    }
    if (fs.existsSync(this.workDir)) {
      fs.rmSync(this.workDir, { recursive: true });
    }
  }
}
