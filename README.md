# Firecracker Lambda

A self-managed serverless function runtime using Firecracker as the underlying lightweight virtual machine platform.

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

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run examples
npm run -w controller dev help
npm run -w controller dev deploy hello examples/hello.ts
npm run -w controller dev invoke hello '{"name":"World"}'
```

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
