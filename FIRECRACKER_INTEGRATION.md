# Firecracker Integration Guide

This document describes the Firecracker VM integration for the serverless runtime.

## Architecture

```
┌─────────────────────────────┐
│  Host (Linux/macOS)         │
│  ┌───────────────────────┐  │
│  │  Controller          │  │
│  │  (deploy/invoke)     │  │
│  └───────────┬───────────┘  │
│              │               │
│     ┌────────▼────────┐     │
│     │ Firecracker API │     │
│     │ (Unix socket)   │     │
│     └────────┬────────┘     │
│              │               │
│     ┌────────▼────────┐     │
│     │ Firecracker VMM│     │
│     │ (KVM-based)    │     │
│     └────────┬────────┘     │
│              │               │
│              ▼               │
│  ┌─────────────────────┐   │
│  │  Lightweight VM     │   │
│  │  ┌───────────────┐  │   │
│  │  │ Minimal Linux │  │   │
│  │  │ + Node.js     │  │   │
│  │  │ + Function    │  │   │
│  │  └───────────────┘  │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

## Components

### 1. Firecracker Client (`@firecracker-lambda/firecracker/src/client.ts`)

Low-level HTTP client that communicates with Firecracker's API via Unix socket.

**Key Methods:**
- `configureVM()` — Set vCPU count and memory
- `setBootSource()` — Configure kernel and boot params
- `addBlockDevice()` — Attach rootfs or other storage
- `startVM()` — Boot the VM
- `stopVM()` — Halt the VM
- `getMetrics()` — Monitor VM performance

### 2. VM Manager (`@firecracker-lambda/firecracker/src/vm-manager.ts`)

High-level orchestrator that manages VM lifecycle.

**Capabilities:**
- Automatic minimal rootfs creation
- VM initialization and configuration
- Bundle execution within the VM
- Resource cleanup

**Constructor Options:**
```typescript
{
  vcpuCount?: number;        // Default: 1
  memMB?: number;            // Default: 128
  kernelPath: string;        // Path to Linux kernel image
  rootfsPath?: string;       // Optional custom rootfs (auto-created if not provided)
}
```

### 3. Controller Integration (`controller/src/vm.ts`)

The controller now supports both Node.js and Firecracker execution modes.

**Usage:**
```typescript
const vm = new FirecrackerVM({
  useFirecracker: true,                    // Enable Firecracker
  kernelImage: "/path/to/kernel",         // Required for Firecracker
  vcpuCount: 2,
  memMB: 256,
});

const result = await vm.execute(bundlePath, { foo: "bar" });
```

## Prerequisites

### System Requirements

- Linux host with KVM support
- Root or appropriate capabilities for Firecracker
- At least 200MB free space for minimal rootfs

### Install Firecracker

```bash
# Download latest release
wget https://github.com/firecracker-microvm/firecracker/releases/download/v1.8.0/firecracker-v1.8.0-x86_64
chmod +x firecracker-v1.8.0-x86_64
sudo mv firecracker-v1.8.0-x86_64 /usr/local/bin/firecracker

# Verify
firecracker --version
```

### Obtain Linux Kernel

```bash
# Use a minimal kernel (e.g., from buildroot or Ubuntu)
wget https://s3.amazonaws.com/firecracker-downloads/linux/5.10/x86_64/vmlinux-5.10
```

## Usage

### Deploy with Firecracker

```bash
# Set environment variable for Firecracker binary location
export FIRECRACKER_BIN=/usr/local/bin/firecracker

# Deploy function
npm run -w controller dev deploy hello examples/hello.ts

# Invoke with Firecracker (requires kernel path)
# Note: Full integration coming soon
npm run -w controller dev invoke hello '{"name":"World"}'
```

### Configure in Code

```typescript
import { FunctionController } from "@firecracker-lambda/controller";

const controller = new FunctionController();

// Deploy
await controller.deploy({
  name: "my-function",
  sourceFile: "./my-function.ts",
});

// Invoke with Firecracker
const vm = new FirecrackerVM({
  useFirecracker: true,
  kernelImage: "/path/to/vmlinux",
  vcpuCount: 2,
  memMB: 256,
});

const result = await vm.execute("/path/to/bundle.js", { data: "..." });
```

## Performance Characteristics

### Cold Start Time

- **Firecracker:** 50-200ms (VM boot + function execution)
- **Node.js:** 5-20ms (process spawn + function execution)

### Memory Overhead

- **Per VM:** ~30-50MB (minimal rootfs + kernel pages)
- **Per Node process:** ~10-20MB

### Best Use Cases

- **Firecracker:** Multi-tenant, security-critical workloads
- **Node.js:** Development, internal tools, testing

## Minimal Rootfs

The VM manager automatically creates a minimal ext4 rootfs containing:

- Bash shell
- Core system directories
- Node.js runtime (added in future)
- Your bundled function

Size: ~100MB (can be optimized further)

## Future Enhancements

- [ ] Copy Node.js into rootfs for complete isolation
- [ ] Network interface support
- [ ] vsock communication for function I/O
- [ ] Snapshots for faster cold starts
- [ ] Memory ballooning for overcommit
- [ ] Custom network namespaces
- [ ] Persistent shared storage

## Troubleshooting

### "Socket not available" error

```bash
# Firecracker may not be installed or not in PATH
which firecracker
export FIRECRACKER_BIN=$(which firecracker)
```

### "Permission denied" error

```bash
# Firecracker requires KVM access
# On Linux:
sudo usermod -aG kvm $USER
# Then log out and log back in
```

### VM doesn't start

```bash
# Check kernel image validity
file /path/to/vmlinux  # Should be "Linux kernel"

# Enable debug logging
export DEBUG=firecracker:*
```

## Security Model

Firecracker VMs provide:
- **Hardware isolation** via KVM
- **Minimal attack surface** (no unnecessary devices)
- **Memory isolation** (each VM has private memory)
- **Process isolation** (independent from host)

Suitable for:
- Multi-tenant function execution
- Untrusted code execution
- Compliance-heavy workloads
