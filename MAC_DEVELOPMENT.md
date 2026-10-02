# macOS Development Guide

Complete guide to developing Firecracker Lambda on macOS.

## TL;DR

On macOS, use **Node.js execution mode** (default) for development:

```bash
npm install
npm run build
npm run -w controller dev deploy hello examples/hello.ts
npm run -w controller dev invoke hello '{"name":"World"}'
```

Done! This works great for development and testing.

## Why Node.js Mode on Mac?

| Aspect | Reason |
|--------|--------|
| **No KVM** | macOS doesn't support Linux KVM |
| **No Firecracker** | Firecracker requires Linux kernel |
| **Fast iteration** | Node.js processes start in 5-20ms |
| **Easy debugging** | Full TypeScript support, breakpoints work |
| **Same bundles** | Bundles work on both Mac (Node.js) and Linux (Firecracker) |

## Complete Development Setup

### 1. Install Node.js

```bash
# Using Homebrew
brew install node

# Or via https://nodejs.org
```

### 2. Clone and Install

```bash
cd /Users/eltoncosta/coderepo/firecracker-lambda
npm install
```

### 3. Build

```bash
npm run build
```

Compiles all TypeScript packages:
- `framework/` — Handler types
- `bundler/` — esbuild tree-shaking
- `runtime/` — Function executor
- `controller/` — CLI and orchestration

### 4. Development Workflow

```bash
# Deploy a function
npm run -w controller dev deploy myfunction examples/hello.ts

# Invoke it
npm run -w controller dev invoke myfunction '{"name":"Alice"}'

# List deployed functions
npm run -w controller dev list

# Create your own function
cat > my-function.ts << 'EOF'
import { defineHandler } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  return {
    message: `Hello ${payload.name}`,
    data: { timestamp: new Date().toISOString() }
  };
});
EOF

# Deploy your function
npm run -w controller dev deploy custom my-function.ts

# Invoke it
npm run -w controller dev invoke custom '{"name":"You"}'
```

## Testing Firecracker Locally

### Option A: Docker (Easiest)

```bash
# Start Docker service first (or open Docker Desktop)

# Build the Firecracker container
docker build -f Dockerfile.firecracker -t firecracker-lambda:latest .

# Run it (with Firecracker support inside)
docker run -it --privileged \
  -v "$(pwd)/examples:/app/examples:ro" \
  firecracker-lambda:latest bash

# Inside the container:
npm run -w controller dev deploy hello examples/hello.ts
npm run -w controller dev invoke hello '{"name":"Docker"}'
```

### Option B: Docker Compose

```bash
# Build and start the Firecracker environment
docker-compose up firecracker

# In another terminal:
docker-compose exec firecracker \
  npm run -w controller dev deploy hello examples/hello.ts

docker-compose exec firecracker \
  npm run -w controller dev invoke hello '{"name":"Compose"}'
```

### Option C: Lima VM

[Lima](https://github.com/lima-vm/lima) runs a Linux VM on Mac with better performance:

```bash
# Install Lima
brew install lima

# Start default Linux VM
limactl start default

# SSH into the VM
limactl shell default

# Inside the Linux VM (has KVM):
git clone <repo>
cd firecracker-lambda
./scripts/setup-firecracker.sh
npm run build
npm run -w controller dev invoke hello '{"name":"Lima"}'
```

### Option D: Colima

[Colima](https://github.com/abiosoft/colima) is a lightweight container runtime:

```bash
# Install Colima
brew install colima

# Start with KVM support
colima start --vm-type=qemu --cpu=4 --memory=8

# Build and test
docker build -f Dockerfile.firecracker -t firecracker-lambda .
docker run -it --privileged firecracker-lambda:latest
```

## Workflow: Mac → Linux Deployment

### Development on Mac

```bash
# Use Node.js mode for rapid iteration
npm run -w controller dev deploy myfunction myfunction.ts
npm run -w controller dev invoke myfunction '{"data":"test"}'

# Version your function
git commit -m "feat: Add myfunction"
```

### Bundle Creation

```bash
# Create a deployment bundle
npm run -w bundler dev \
  bundle examples/hello.ts \
  --out dist/hello.js

# This bundle works on:
# - Local Mac (Node.js) ✅
# - Linux (Firecracker) ✅
# - AWS Lambda ✅
# - Other serverless platforms ✅
```

### Deploy to Linux Server

```bash
# Copy bundle to Linux server
scp dist/hello.js user@server.com:/tmp/

# SSH into server
ssh user@server.com

# On the server (with Firecracker installed)
./scripts/setup-firecracker.sh
firecracker-lambda deploy hello /tmp/hello.js
firecracker-lambda invoke hello '{"name":"Production"}'
```

## Performance on Mac

### Node.js Mode (Local)

```
Cold start:        5-20ms
Memory per func:   10-30MB
Suitable for:      Development, testing, debugging
```

### Firecracker Mode (Linux)

```
Cold start:        50-200ms
Memory per func:   150-200MB
Suitable for:      Production, multi-tenant, security
```

### Development Tips

- **Fast iteration:** Use Node.js mode locally
- **Test thoroughly:** Before deploying to production
- **Benchmark:** Compare performance between modes
- **Profile:** Use Node.js profiler on Mac

## Debugging

### Enable Debug Logs

```bash
# Show detailed bundler output
DEBUG=esbuild npm run -w bundler dev bundle examples/hello.ts

# Show controller debug info
DEBUG=firecracker npm run -w controller dev invoke hello '{"name":"test"}'
```

### Debug with VS Code

```bash
# Open in VS Code
code .

# Create .vscode/launch.json
```

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Deploy Function",
      "program": "${workspaceFolder}/controller/dist/cli.js",
      "args": ["deploy", "hello", "examples/hello.ts"],
      "outFiles": ["${workspaceFolder}/**/dist/**/*.js"]
    }
  ]
}
```

### Watch Mode

```bash
# Automatically rebuild on changes
npm run -w framework dev  # Watch framework
npm run -w bundler dev   # Watch bundler
npm run -w controller dev # Watch controller

# In another terminal, develop:
# Edit examples/hello.ts
# npm run -w controller dev deploy hello examples/hello.ts
```

## Troubleshooting

### Port Already in Use

```bash
# If port 3000 is taken
lsof -i :3000
kill -9 <PID>
```

### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### TypeScript Errors

```bash
# Check for type errors
npx tsc --noEmit

# Build with type checking
npm run build
```

### Out of Memory

```bash
# Increase Node.js heap for bundling large functions
NODE_OPTIONS="--max-old-space-size=4096" npm run -w bundler dev bundle huge-function.ts
```

## Next Steps

1. ✅ Develop on macOS with Node.js mode
2. 🔒 Test with Firecracker in Docker (optional)
3. 📦 Create deployment bundles
4. 🚀 Deploy bundles to Linux servers with Firecracker
5. 📊 Monitor and optimize in production

## Resources

- [Deployment Guide](DEPLOYMENT_GUIDE.md) — Cross-platform workflow
- [Firecracker Integration](FIRECRACKER_INTEGRATION.md) — Deep dive on Firecracker
- [Lima](https://github.com/lima-vm/lima) — Linux VMs on Mac
- [Docker Desktop](https://www.docker.com/products/docker-desktop) — Containers on Mac

## Summary

**macOS:** Use Node.js mode for development ⚡  
**Linux:** Use Firecracker mode for production 🔒  
**Bundles:** Work everywhere once created ✅
