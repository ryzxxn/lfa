import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export interface VMConfig {
  vcpuCount?: number;
  memMB?: number;
  kernelImage: string;
  rootfs: string;
  workDir?: string;
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

  constructor(config: VMConfig) {
    this.config = {
      vcpuCount: 1,
      memMB: 128,
      ...config,
    };
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

  cleanup(): void {
    if (this.process) {
      this.process.kill();
    }
    if (fs.existsSync(this.workDir)) {
      fs.rmSync(this.workDir, { recursive: true });
    }
  }
}
