# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

This installs dependencies for all workspaces.

## 2. Build Everything

```bash
npm run build
```

Compiles TypeScript in all packages:
- `framework/` → types and utilities
- `bundler/` → bundling CLI
- `runtime/` → function executor
- `controller/` → orchestration CLI

## 3. Deploy a Function

```bash
npm run -w controller dev deploy hello examples/hello.ts
```

This:
1. Bundles `examples/hello.ts` using esbuild
2. Tree-shakes to include only code the function needs
3. Stores it for later invocation

Check the output in `/tmp/fc-deployments/`

## 4. Invoke the Function

```bash
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

## 5. Try Another Example

Deploy the compute function:

```bash
npm run -w controller dev deploy compute examples/compute.ts
```

Invoke it:

```bash
npm run -w controller dev invoke compute '{"n":10}'
```

## Understanding the Flow

```
examples/hello.ts (user writes)
    ↓
Framework imports analyzed (@firecracker-lambda/framework)
    ↓
Bundler (esbuild) tree-shakes
    ↓
Minimal bundle created
    ↓
Runtime executor loads bundle
    ↓
Function handler invoked
    ↓
Response returned to controller
    ↓
Process exits, resources cleaned up
```

## Key Points

- **No external dependencies at runtime** — Everything needed is bundled
- **Minimal bundles** — Tree-shaking removes unused code
- **Auto-cleanup** — Functions terminate immediately after execution
- **Type-safe** — Full TypeScript support during development

## What's Next?

- Add a HTTP API layer to the controller
- Implement true Firecracker VM integration
- Add persistent function storage
- Create a web dashboard
- Add metrics and logging
