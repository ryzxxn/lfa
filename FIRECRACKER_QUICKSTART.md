# Firecracker Quick Start

Get Firecracker Lambda up and running with true VM isolation.

## 1. Prerequisites

**System:**
- Linux host (Ubuntu 20.04+ recommended)
- Intel/AMD CPU with KVM support
- At least 2GB free RAM
- 500MB free disk space

**Check KVM support:**
```bash
grep -o 'vmx\|svm' /proc/cpuinfo | head -1
# Output: vmx (Intel) or svm (AMD) = good
```

## 2. Setup

```bash
# Run the automated setup script
cd /Users/eltoncosta/coderepo/firecracker-lambda
./scripts/setup-firecracker.sh
```

The script will:
- ✅ Verify KVM support
- ✅ Download Firecracker binary
- ✅ Download minimal Linux kernel
- ✅ Configure user permissions

## 3. Test Installation

```bash
# Verify Firecracker
firecracker --version
# or
export FIRECRACKER_BIN=/usr/local/bin/firecracker

# Verify kernel
file ./kernels/vmlinux-5.10
# Should output: Linux kernel x86 boot executable
```

## 4. Deploy a Function

```bash
cd /Users/eltoncosta/coderepo/firecracker-lambda

# Build
npm run build

# Deploy
npm run -w controller dev deploy hello examples/hello.ts
```

## 5. Invoke with Firecracker

**Option A: Programmatically**

```typescript
import { FirecrackerVM } from "@firecracker-lambda/controller";

const vm = new FirecrackerVM({
  useFirecracker: true,
  kernelImage: "./kernels/vmlinux-5.10",
  vcpuCount: 1,
  memMB: 128,
});

const result = await vm.execute(bundlePath, { name: "World" });
console.log(result.stdout);

vm.cleanup();
```

**Option B: Via Controller**

```typescript
import { FunctionController } from "@firecracker-lambda/controller";

const controller = new FunctionController();

// Future: Full integration coming
await controller.deploy({
  name: "hello",
  sourceFile: "examples/hello.ts",
});
```

## 6. Verify It Works

```bash
# Should see VM creation and execution
npm run -w controller dev invoke hello '{"name":"Firecracker"}'
```

## Performance Tips

### Fast Cold Starts
- Use minimal kernel (current: 5.10)
- Reduce rootfs size
- Pre-warm VM pools (future feature)

### Memory Efficiency
- Default 128MB per VM (adjust with `memMB`)
- Minimal rootfs ~100MB
- Total: ~150MB per VM

### CPU Efficiency
- Default 1 vCPU per VM
- Add more for compute-heavy workloads
- Oversubscribe with caution

## Common Issues

### "Permission denied" when starting VM

```bash
# Add user to kvm group
sudo usermod -aG kvm $USER

# Log out and back in for changes to take effect
# Verify:
id | grep kvm  # Should show kvm group
```

### "Socket not available" error

```bash
# Check if Firecracker is installed
which firecracker

# If not found, set environment variable
export FIRECRACKER_BIN=/path/to/firecracker
```

### "Kernel file not found"

```bash
# Download kernel if missing
./scripts/setup-firecracker.sh

# Or manually
wget https://s3.amazonaws.com/firecracker-downloads/linux/5.10/x86_64/vmlinux-5.10 -O kernels/vmlinux-5.10

# Verify
file kernels/vmlinux-5.10
```

### High memory usage

- Reduce `memMB` parameter (minimum 100)
- Don't create too many VMs at once
- Monitor with `top` or `htop`

## Security Highlights

Firecracker provides:
- **Hardware isolation** — Each VM is isolated at CPU/memory level
- **Minimal attack surface** — No unnecessary devices or features
- **Process isolation** — Independent from host processes
- **Multi-tenant ready** — Suitable for untrusted code

## Next Steps

- 📚 Read [FIRECRACKER_INTEGRATION.md](FIRECRACKER_INTEGRATION.md) for deep dive
- 🔧 Customize VM resources (CPU, memory) for your workloads
- 🌐 Add network interface support (coming soon)
- 📊 Monitor metrics with `vm.getMetrics()`

## Troubleshooting

Check logs:
```bash
# Kernel messages
dmesg | tail -20

# Firecracker debug
export RUST_LOG=debug
firecracker --config-file config.json
```

Get help:
```bash
# List available CLI commands
npm run -w controller dev help

# Check source code
cat firecracker/src/client.ts  # API interface
cat firecracker/src/vm-manager.ts  # VM lifecycle
```
