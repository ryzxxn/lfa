import { FirecrackerClient, VMConfiguration, BootSourceConfig } from "./client";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, execSync } from "child_process";

export interface VMConfig {
  vcpuCount?: number;
  memMB?: number;
  kernelPath: string;
  rootfsPath?: string;
}

export interface ExecutionRequest {
  bundlePath: string;
  payload: Record<string, any>;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class FirecrackerVMManager {
  private config: VMConfig;
  private socketPath: string;
  private vmId: string;
  private client?: FirecrackerClient;
  private workDir: string;

  constructor(config: VMConfig) {
    this.config = {
      vcpuCount: 1,
      memMB: 128,
      ...config,
    };
    this.vmId = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.socketPath = path.join(os.tmpdir(), `firecracker-${this.vmId}.sock`);
    this.workDir = path.join(os.tmpdir(), `firecracker-work-${this.vmId}`);

    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    this.client = new FirecrackerClient({
      socketPath: this.socketPath,
    });

    await this.startFirecrackerProcess();
    await this.waitForSocket(5000);
    await this.configureVM();
  }

  private async startFirecrackerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const firecrackerBinary = process.env.FIRECRACKER_BIN || "firecracker";

      const child = spawn(firecrackerBinary, [
        "--config-file",
        this.getConfigPath(),
      ]);

      child.on("error", reject);
      child.on("spawn", () => {
        setTimeout(resolve, 500);
      });

      child.stderr?.on("data", (data) => {
        console.error(`[firecracker] ${data.toString()}`);
      });

      child.stdout?.on("data", (data) => {
        console.log(`[firecracker] ${data.toString()}`);
      });
    });
  }

  private getConfigPath(): string {
    const configPath = path.join(this.workDir, "vm-config.json");

    const config = {
      boot_source: {
        kernel_image_path: this.config.kernelPath,
        cmdline: "quiet reboot=k console=ttyS0 noapic nomodules rw",
      },
      drives: [
        {
          drive_id: "rootfs",
          path_on_host: this.config.rootfsPath || this.createMinimalRootfs(),
          is_root_device: true,
          is_read_only: false,
        },
      ],
      machine_config: {
        vcpu_count: this.config.vcpuCount,
        mem_size_mib: this.config.memMB,
        smt: false,
      },
      ipc: {
        socket_path: this.socketPath,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  private createMinimalRootfs(): string {
    const rootfsPath = path.join(this.workDir, "rootfs.ext4");

    if (fs.existsSync(rootfsPath)) {
      return rootfsPath;
    }

    console.log(`Creating minimal rootfs at ${rootfsPath}...`);

    try {
      execSync(`dd if=/dev/zero of=${rootfsPath} bs=1M count=100`, {
        stdio: "pipe",
      });
      execSync(`mkfs.ext4 -F ${rootfsPath}`, { stdio: "pipe" });

      const mntDir = path.join(this.workDir, "mnt");
      fs.mkdirSync(mntDir, { recursive: true });

      execSync(`mount -o loop ${rootfsPath} ${mntDir}`, { stdio: "pipe" });

      try {
        fs.mkdirSync(path.join(mntDir, "bin"), { recursive: true });
        fs.mkdirSync(path.join(mntDir, "sbin"), { recursive: true });
        fs.mkdirSync(path.join(mntDir, "etc"), { recursive: true });
        fs.mkdirSync(path.join(mntDir, "lib"), { recursive: true });
        fs.mkdirSync(path.join(mntDir, "var"), { recursive: true });
        fs.mkdirSync(path.join(mntDir, "root"), { recursive: true });

        execSync(`cp /bin/bash ${path.join(mntDir, "bin/bash")}`, {
          stdio: "pipe",
        });
        execSync(`cp /bin/sh ${path.join(mntDir, "bin/sh")}`, {
          stdio: "pipe",
        });

        const initScript = `#!/bin/bash
set -e

echo "Firecracker VM started"
exec /bin/bash
`;

        fs.writeFileSync(path.join(mntDir, "init"), initScript);
        fs.chmodSync(path.join(mntDir, "init"), 0o755);
      } finally {
        execSync(`umount ${mntDir}`, { stdio: "pipe" });
      }

      console.log(`Rootfs created: ${rootfsPath}`);
    } catch (error) {
      console.error("Failed to create rootfs:", error);
      throw error;
    }

    return rootfsPath;
  }

  private async waitForSocket(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (fs.existsSync(this.socketPath)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(
      `Firecracker socket not available after ${timeoutMs}ms at ${this.socketPath}`
    );
  }

  private async configureVM(): Promise<void> {
    if (!this.client) throw new Error("Client not initialized");

    await this.client.configureVM({
      vcpu_count: this.config.vcpuCount!,
      mem_size_mib: this.config.memMB!,
    });

    const bootSource: BootSourceConfig = {
      kernel_image_path: this.config.kernelPath,
      cmdline: "quiet reboot=k console=ttyS0 noapic nomodules rw",
    };

    await this.client.setBootSource(bootSource);

    const rootfsPath = this.config.rootfsPath || this.createMinimalRootfs();

    await this.client.addBlockDevice({
      drive_id: "rootfs",
      path_on_host: rootfsPath,
      is_root_device: true,
      is_read_only: false,
    });
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!this.client) throw new Error("VM not initialized");

    try {
      console.log(`Starting VM ${this.vmId}...`);
      await this.client.startVM();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result: ExecutionResult = {
        stdout: "VM execution placeholder",
        stderr: "",
        exitCode: 0,
      };

      return result;
    } catch (error) {
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      try {
        await this.client.stopVM();
      } catch (error) {
        console.error("Error stopping VM:", error);
      }
    }

    if (fs.existsSync(this.workDir)) {
      fs.rmSync(this.workDir, { recursive: true, force: true });
    }
  }

  getVMId(): string {
    return this.vmId;
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}
