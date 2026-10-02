import * as net from "net";

export interface FirecrackerConfig {
  socketPath: string;
}

export interface VMConfiguration {
  vcpu_count: number;
  mem_size_mib: number;
  smt?: boolean;
}

export interface BootSourceConfig {
  kernel_image_path: string;
  cmdline?: string;
  boot_args?: string;
}

export interface BlockDevice {
  drive_id: string;
  path_on_host: string;
  is_root_device: boolean;
  is_read_only?: boolean;
}

export interface NetworkInterface {
  iface_id: string;
  host_dev_name: string;
  rx_rate_limiter?: any;
  tx_rate_limiter?: any;
}

export interface VsockConfig {
  vsock_id: string;
  guest_cid: number;
}

export class FirecrackerClient {
  private socketPath: string;

  constructor(config: FirecrackerConfig) {
    this.socketPath = config.socketPath;
  }

  private async request(
    method: string,
    path: string,
    body?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath, () => {
        const bodyStr = body ? JSON.stringify(body) : "";
        const contentLength = bodyStr.length;

        const request = `${method} ${path} HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${contentLength}\r\nContent-Type: application/json\r\n\r\n${bodyStr}`;

        socket.write(request);
      });

      let response = "";

      socket.on("data", (data) => {
        response += data.toString();
      });

      socket.on("end", () => {
        const parts = response.split("\r\n\r\n");
        const body = parts.slice(1).join("\r\n\r\n");

        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch {
          resolve(body);
        }

        socket.destroy();
      });

      socket.on("error", reject);
    });
  }

  async configureVM(config: VMConfiguration): Promise<void> {
    await this.request("PUT", "/machine", config);
  }

  async getVMConfig(): Promise<VMConfiguration> {
    return this.request("GET", "/machine");
  }

  async setBootSource(config: BootSourceConfig): Promise<void> {
    await this.request("PUT", "/boot-source", config);
  }

  async addBlockDevice(device: BlockDevice): Promise<void> {
    const path = `/drives/${device.drive_id}`;
    await this.request("PUT", path, {
      drive_id: device.drive_id,
      path_on_host: device.path_on_host,
      is_root_device: device.is_root_device,
      is_read_only: device.is_read_only ?? false,
    });
  }

  async addNetworkInterface(iface: NetworkInterface): Promise<void> {
    const path = `/network-interfaces/${iface.iface_id}`;
    await this.request("PUT", path, {
      iface_id: iface.iface_id,
      host_dev_name: iface.host_dev_name,
    });
  }

  async addVsockDevice(config: VsockConfig): Promise<void> {
    await this.request("PUT", "/vsocks", {
      vsock_id: config.vsock_id,
      guest_cid: config.guest_cid,
    });
  }

  async startVM(): Promise<void> {
    await this.request("PUT", "/actions", { action_type: "InstanceStart" });
  }

  async stopVM(): Promise<void> {
    await this.request("PUT", "/actions", { action_type: "SendCtrlAltDel" });
  }

  async getInstanceInfo(): Promise<any> {
    return this.request("GET", "/instance-info");
  }

  async getMetrics(): Promise<any> {
    return this.request("GET", "/metrics");
  }
}
