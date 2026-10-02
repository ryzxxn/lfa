# Firecracker VM Features & Capabilities

Complete reference of what you can do with Firecracker VMs.

---

## 🎮 Core VM Management

### 1. Machine Configuration
**Endpoint:** `PUT /machine`

Control VM hardware specs:

```typescript
{
  vcpu_count: number;        // Number of vCPUs (1-32)
  mem_size_mib: number;      // Memory in MB (128-68GB)
  smt: boolean;              // Simultaneous Multi-Threading
  cpu_template?: "C3" | "T2" | "T3" | "T3s" | "T2s" | "T2cl" | "T3a";
  track_dirty_pages: boolean;  // For snapshots
}
```

**Use case:** Control VM resources
```typescript
// Create 2-vCPU, 512MB RAM VM
await client.configureVM({
  vcpu_count: 2,
  mem_size_mib: 512,
  smt: false
});
```

### 2. CPU Configuration
**Endpoint:** `PUT /cpu-config`

Fine-tune CPU behavior:

```typescript
{
  cpuid_modulation: boolean;
  cpu_template?: string;
}
```

### 3. VM State
**Endpoint:** `GET /vm`

Get current VM state

```typescript
const state = await client.getVMState();
// {
//   state: "Running" | "Halted" | "Paused"
// }
```

---

## 🔧 Boot & Kernel

### Boot Source Configuration
**Endpoint:** `PUT /boot-source`

Configure how VM boots:

```typescript
{
  kernel_image_path: string;  // Path to kernel image
  cmdline?: string;           // Kernel command-line args
  boot_args?: string;
}
```

**Example:**
```typescript
await client.setBootSource({
  kernel_image_path: "/path/to/vmlinux-5.10",
  cmdline: "console=ttyS0 noapic nomodules rw quiet"
});
```

**Common kernel arguments:**
```
console=ttyS0           # Use serial console
noapic                  # Disable APIC
nomodules              # No loadable modules
rw                     # Read-write filesystem
quiet                  # Suppress boot messages
reboot=k               # Reboot via keyboard
```

---

## 💾 Storage & Disks

### Block Devices (Storage)
**Endpoint:** `PUT /drives/{drive_id}`

Attach virtual disks:

```typescript
{
  drive_id: string;          // Unique ID
  path_on_host: string;      // Host filesystem path
  is_root_device: boolean;   // Boot device?
  is_read_only?: boolean;    // Read-only?
  partuuid?: string;         // Partition UUID
}
```

**Example:**
```typescript
// Add root filesystem
await client.addBlockDevice({
  drive_id: "rootfs",
  path_on_host: "/mnt/rootfs.ext4",
  is_root_device: true,
  is_read_only: false
});

// Add read-only data disk
await client.addBlockDevice({
  drive_id: "data",
  path_on_host: "/mnt/data.iso",
  is_root_device: false,
  is_read_only: true
});
```

### PMEM (Persistent Memory)
**Endpoint:** `PUT /pmem/{pmem_id}`

Attach persistent memory regions:

```typescript
{
  pmem_id: string;
  path_on_host: string;
}
```

**Use case:** Ultra-fast shared memory for large datasets

---

## 🌐 Networking

### Network Interfaces
**Endpoint:** `PUT /network-interfaces/{iface_id}`

Attach network adapters:

```typescript
{
  iface_id: string;
  host_dev_name: string;     // TAP device name
  rx_rate_limiter?: RateLimiter;
  tx_rate_limiter?: RateLimiter;
}
```

**Example:**
```typescript
// Attach network interface
await client.addNetworkInterface({
  iface_id: "eth0",
  host_dev_name: "tap0",
  rx_rate_limiter: {
    bandwidth: {
      size: 1000000,       // 1Mbps
      refill_time: 100
    }
  }
});
```

### MMDS (Microservice Metadata Service)
**Endpoint:** `PUT /mmds | GET /mmds`

Pass metadata to VM via a local service:

```typescript
// Set metadata
const metadata = {
  latest: {
    meta_data: {
      instance_id: "my-vm-123",
      local_ipv4: "172.17.0.2"
    }
  }
};

// VM can query: http://169.254.169.254/latest/meta-data/
```

**Use case:** Configuration injection without modifying image

### Vsock (Virtual Socket)
**Endpoint:** `PUT /vsock`

Direct VM ↔ Host communication:

```typescript
{
  vsock_id: string;
  guest_cid: number;         // Context ID (3+)
  uds_path: string;          // Unix domain socket
}
```

**Example:**
```typescript
await client.addVsockDevice({
  vsock_id: "vsock0",
  guest_cid: 3,
  uds_path: "/tmp/vsock.sock"
});
```

**Use case:** Low-latency host-VM communication (better than network)

---

## 📊 Monitoring & Metrics

### Metrics
**Endpoint:** `GET /metrics`

Get VM performance metrics:

```typescript
const metrics = await client.getMetrics();
// {
//   cpu_utilization_us: number,
//   memory_utilization_bytes: number,
//   net_rx_bytes: number,
//   net_tx_bytes: number,
//   ...
// }
```

### Instance Info
**Endpoint:** `GET /instance-info`

Get VM information:

```typescript
const info = await client.getInstanceInfo();
// {
//   state: "Running",
//   memory_size: 512,
//   vcpu_count: 2,
//   ...
// }
```

### Logging
**Endpoint:** `PUT /logger`

Configure VM logging:

```typescript
{
  log_path: string;        // Log file path
  level: "Debug" | "Info" | "Warning" | "Error";
  show_level: boolean;
  show_log_origin: boolean;
}
```

---

## ⚡ VM Control

### Actions
**Endpoint:** `PUT /actions`

Control VM execution:

```typescript
// Start VM
await client.startVM();

// Send Ctrl+Alt+Del (graceful shutdown)
await client.sendCtrlAltDel();

// Pause VM (snapshot-related)
await client.pauseVM();

// Resume VM
await client.resumeVM();
```

### Serial Console
**Endpoint:** `PUT /serial | GET /serial`

Configure serial port:

```typescript
{
  log_path: string;        // Log serial output
}
```

---

## 🎬 Snapshots & Checkpoints

### Create Snapshot
```typescript
// Pause VM
await client.pauseVM();

// Create checkpoint
const snapshot = await client.createSnapshot({
  snapshot_path: "/path/to/snapshot",
  mem_file_path: "/path/to/memory.bin"
});

// Resume VM
await client.resumeVM();
```

**Use case:** Fast VM restoration (sub-millisecond boot)

---

## 📡 Rate Limiting

### RX/TX Rate Limiting
Control network bandwidth:

```typescript
const rateLimiter = {
  bandwidth: {
    size: 1000000,         // Bytes
    refill_time: 100       // Milliseconds
  },
  ops: {
    size: 1000,            // Operations
    refill_time: 100
  }
};
```

**Use case:** Fair resource sharing

---

## 🔐 Entropy & Randomness

### Entropy Device
**Endpoint:** `PUT /entropy`

Provide entropy to VM:

```typescript
{
  rate_limiter?: RateLimiter;  // Limit entropy rate
}
```

**Use case:** Seed /dev/urandom in guest

---

## 📋 Version Info

### Version
**Endpoint:** `GET /version`

Get Firecracker version:

```typescript
const version = await client.getVersion();
// {
//   firecracker_version: "1.8.0",
//   state: "Running"
// }
```

---

## 🎯 Feature Matrix: What You Can Do

| Feature | Available | Use Case |
|---------|-----------|----------|
| **CPU Control** | ✅ | Set vCPU count, SMT |
| **Memory** | ✅ | Set RAM size |
| **Boot** | ✅ | Kernel + cmdline |
| **Root Filesystem** | ✅ | ext4, ext3, btrfs |
| **Extra Disks** | ✅ | Data volumes |
| **Networking** | ✅ | TAP devices, bandwidth limiting |
| **Vsock** | ✅ | Fast host-VM comms |
| **MMDS** | ✅ | Metadata service |
| **Snapshots** | ✅ | Fast restore |
| **Monitoring** | ✅ | Metrics collection |
| **Serial Console** | ✅ | VM output capture |
| **GPU** | ❌ | Not supported |
| **USB** | ❌ | Not supported |
| **PCI Passthrough** | ❌ | Not supported |
| **Nested Virtualization** | ❌ | Not supported |

---

## 💡 For Your AI Agent Infrastructure

### What You Should Use

**Must Have:**
- ✅ CPU/Memory config → Constrain agent functions
- ✅ Block device → Minimal rootfs
- ✅ Boot source → Linux kernel + init
- ✅ Actions → Start/stop VMs

**Highly Recommended:**
- ✅ Vsock → Fast function I/O
- ✅ Metrics → Monitor function performance
- ✅ Serial console → Debug VM issues
- ✅ Snapshots → Faster cold starts

**Optional:**
- ⚪ MMDS → Pass config to functions
- ⚪ Rate limiting → Fair resource sharing
- ⚪ Entropy → Better randomness

**Not Available (but OK):**
- ❌ GPU → Use CPU-only or delegate
- ❌ PCI → Not needed for functions
- ❌ USB → Not needed

---

## 🔧 Recommended VM Configuration for Functions

### For Lightweight Functions (Default)

```typescript
{
  vcpu_count: 1,
  mem_size_mib: 128,
  kernel_image_path: "/kernels/vmlinux-5.10",
  rootfs_path: "/rootfs/minimal.ext4",
  boot_source: {
    cmdline: "console=ttyS0 noapic nomodules rw quiet reboot=k"
  }
}
```

**Characteristics:**
- Cold start: 20-30ms
- Memory: 128MB
- CPU: Single core

### For ML Functions (GPU-like workloads)

```typescript
{
  vcpu_count: 4,
  mem_size_mib: 2048,
  kernel_image_path: "/kernels/vmlinux-5.10",
  rootfs_path: "/rootfs/ml-full.ext4"
}
```

**Characteristics:**
- Cold start: 30-50ms
- Memory: 2GB
- CPU: 4 cores
- Includes torch, transformers, etc.

### For Long-Running Jobs

```typescript
{
  vcpu_count: 8,
  mem_size_mib: 4096,
  kernel_image_path: "/kernels/vmlinux-5.10",
  rootfs_path: "/rootfs/full.ext4",
  snapshots_enabled: true
}
```

**Characteristics:**
- Can take snapshots
- More resources available
- Good for batch processing

---

## 🚀 Advanced Patterns

### Pattern 1: Function with Data Volume

```typescript
// Configure VM
await client.configureVM({ vcpu_count: 2, mem_size_mib: 256 });

// Boot kernel
await client.setBootSource({ kernel_image_path: "/path/kernel" });

// Add root filesystem
await client.addBlockDevice({
  drive_id: "root",
  path_on_host: "/mnt/rootfs.ext4",
  is_root_device: true
});

// Add data volume (read-only)
await client.addBlockDevice({
  drive_id: "data",
  path_on_host: "/mnt/models.iso",  // ML models
  is_root_device: false,
  is_read_only: true
});

// Start VM
await client.startVM();
```

**Result:** Function can read from /dev/vdb (models.iso)

### Pattern 2: Fast Communication with Vsock

```typescript
// Add vsock
await client.addVsockDevice({
  vsock_id: "vsock0",
  guest_cid: 3
});

// In function (guest):
const socket = new Socket();
socket.connect(5678, "host.vsock", () => {
  // Connected to host vsock listener
});
```

**Benefit:** 10x faster than network

### Pattern 3: Config via MMDS

```typescript
// Set metadata
const metadata = {
  latest: {
    meta_data: {
      model_path: "/models/bert-v2",
      batch_size: 32,
      threshold: 0.8
    }
  }
};

// In function (guest):
const config = await fetch("http://169.254.169.254/latest/meta-data/");
```

**Benefit:** Inject config without modifying image

### Pattern 4: Performance Monitoring

```typescript
// Start VM and execute function...

// Get metrics during execution
setInterval(async () => {
  const metrics = await client.getMetrics();
  console.log({
    cpu_us: metrics.cpu_utilization_us,
    mem_bytes: metrics.memory_utilization_bytes,
    net_rx: metrics.net_rx_bytes,
    net_tx: metrics.net_tx_bytes
  });
}, 100);
```

**Benefit:** Real-time performance visibility

---

## 📚 What to Implement in Go

For your Go rewrite, implement these clients:

```go
type FirecrackerClient interface {
  // Machine config
  ConfigureVM(config *VMConfig) error
  GetVMConfig() (*VMConfig, error)
  
  // Boot
  SetBootSource(boot *BootConfig) error
  
  // Storage
  AddBlockDevice(device *BlockDevice) error
  
  // Network
  AddNetworkInterface(iface *NetworkInterface) error
  AddVsockDevice(vsock *VsockConfig) error
  
  // Control
  StartVM() error
  StopVM() error  // Send Ctrl+Alt+Del
  PauseVM() error
  ResumeVM() error
  
  // Monitoring
  GetMetrics() (*Metrics, error)
  GetInstanceInfo() (*InstanceInfo, error)
  
  // Snapshots
  CreateSnapshot(path string) error
  RestoreSnapshot(path string) error
}
```

---

## 🎓 Learning Resources

- [Firecracker Documentation](https://github.com/firecracker-microvm/firecracker/tree/main/docs)
- [API Specification](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)
- [Go SDK](https://github.com/firecracker-microvm/firecracker-go-sdk)

---

## ✨ Summary

Firecracker gives you everything you need for serverless functions:
- ✅ Lightweight VM control
- ✅ Network isolation
- ✅ Storage management
- ✅ Performance monitoring
- ✅ Fast snapshots

What you DON'T get:
- ❌ GPU
- ❌ PCI
- ❌ USB

But that's fine—functions are CPU/memory bound anyway.

**You have plenty of features to build world-class infrastructure!** 🚀
