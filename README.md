# Firecracker Lambda

A self-managed serverless function runtime with dual execution modes:
- **Local (macOS/Linux):** Lightweight Node.js execution for rapid development
- **Production (Linux):** Firecracker VM isolation for secure multi-tenant workloads

## Architecture

```
┌─────────────────┐
│  User Function  │
│   (TypeScript)  │
└────────┬────────┘
         │
         │ import @firecracker-lambda/framework
         │
         v
┌──────────────────┐
│    Bundler       │
│   (esbuild)      │
│ Tree-shaking     │
└────────┬─────────┘
         │
         │ minimal bundle only
         │
         v
┌──────────────────┐
│   Controller     │
│  (orchestrator)  │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Runtime (Node)  │
│  (lightweight)   │
└─────────────────┘
```

## Workspace Structure

- **framework** — Core handler types and utilities for function definitions
- **bundler** — esbuild-based bundler with tree-shaking
- **runtime** — Function executor (runs in lightweight environment)
- **controller** — VM orchestration and invocation management
- **examples** — Sample functions

## How It Works

### 1. Write a Function

```typescript
// examples/hello.ts
import { defineHandler } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  return {
    message: `Hello, ${payload.name}!`,
  };
});
```

### 2. Deploy

```bash
npm run build  # compile everything
npm run -w controller dev deploy hello examples/hello.ts
```

The bundler:
- Analyzes imports from `@firecracker-lambda/framework`
- Includes only what the function uses
- Minifies the output
- Results in a tiny, self-contained bundle

### 3. Invoke

```bash
npm run -w controller dev invoke hello '{"name":"World"}'
```

The controller:
- Loads the bundled function
- Executes it in a lightweight Node.js process
- Returns the result immediately
- Cleans up resources automatically

## Quick Start (macOS)

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Deploy a function (Node.js mode - works on any OS)
npm run -w controller dev deploy hello examples/hello.ts

# Invoke it
npm run -w controller dev invoke hello '{"name":"World"}'
```

Expected output:
```json
{
  "result": {
    "message": "Hello, World!",
    "timestamp": "2024-10-03T..."
  },
  "duration": 42
}
```

**On macOS?** You're done! Node.js mode works perfectly for development.

**On Linux with KVM?** See [Firecracker Integration](FIRECRACKER_INTEGRATION.md) to enable VM isolation.

## Deployment

- **Development (Mac/Linux):** Node.js mode (5-20ms cold start)
- **Production (Linux servers):** Firecracker mode (50-200ms, isolated)

See [Deployment Guide](DEPLOYMENT_GUIDE.md) for:
- Cross-platform workflow
- CI/CD pipeline setup
- Testing Firecracker on Mac with Docker
- Production deployment options

## Key Features

✅ **Tree-shaking** — Only deployed code is bundled  
✅ **Lightweight** — Minimal bundle sizes  
✅ **Instant cleanup** — Functions auto-terminate after execution  
✅ **TypeScript-first** — Full type safety  
✅ **Framework-agnostic** — Use any libraries you want  
✅ **Self-contained** — No external dependencies required at runtime

## Execution Modes

The runtime supports two execution modes:

### 1. **Lightweight Node.js** (Default)
- Fast cold starts (5-20ms)
- Low memory overhead
- Great for development and testing
- Single-tenant execution

### 2. **Firecracker VMs**
- Secure hardware isolation (KVM)
- Multi-tenant capability
- Slightly higher cold start (50-200ms)
- Production-grade security
- See [Firecracker Integration Guide](FIRECRACKER_INTEGRATION.md)

## Future Enhancements

- [ ] Copy Node.js into Firecracker rootfs
- [ ] Network interface support
- [ ] vsock communication for function I/O
- [ ] VM snapshots for faster cold starts
- [ ] Memory/CPU limits per function
- [ ] Concurrent invocations with pooling
- [ ] HTTP API server
- [ ] Persistent storage support
- [ ] Function logs and metrics
