# Deployment Guide: Mac Development → Linux Production

This guide covers developing on macOS while deploying Firecracker to Linux servers.

## Local Development (macOS)

On Mac, use the **lightweight Node.js execution mode** (default):

```bash
npm run build
npm run -w controller dev deploy hello examples/hello.ts
npm run -w controller dev invoke hello '{"name":"World"}'
```

Benefits:
- ✅ Fast cold starts (5-20ms)
- ✅ No VM overhead
- ✅ Full TypeScript debugging
- ✅ Works on any OS

This is perfect for:
- Development and testing
- Local iteration
- CI/CD pipelines
- Internal tools

## Production Deployment (Linux)

Deploy your bundled functions to Linux servers with Firecracker for:
- 🔒 Hardware isolation
- 🛡️ Multi-tenant security
- 📊 Better resource management

### Option 1: Docker-based Firecracker

Deploy as a Docker container with Firecracker inside:

```bash
# On your Linux server
docker pull firecracker-lambda:latest
docker run -d \
  --privileged \
  -v /tmp/firecracker-socket:/tmp/socket \
  firecracker-lambda:latest
```

See [Dockerfile.firecracker](Dockerfile.firecracker)

### Option 2: Manual Linux Server

On a Linux host with KVM:

```bash
# SSH into your Linux server
ssh user@your-server.com

# Install dependencies
./scripts/setup-firecracker.sh

# Deploy your function bundle
firecracker-lambda deploy my-function ./bundle.js

# Invoke
firecracker-lambda invoke my-function '{"data":"..."}'
```

### Option 3: Kubernetes + Kata Containers

Use Kata Containers (which wraps Firecracker) in Kubernetes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: function-executor
spec:
  runtimeClassName: kata
  containers:
  - name: function
    image: firecracker-lambda:latest
    env:
    - name: FUNCTION_BUNDLE
      value: ./hello.js
```

## Cross-Platform Development Workflow

### Development on Mac

```
┌────────────────────┐
│  macOS (your Mac)  │
│                    │
│  ✅ Quick develop  │
│  ✅ Test locally   │
│  ✅ Node.js mode   │
│                    │
│  npm run build     │
│  npm run dev       │
└────────┬───────────┘
         │
         │ git push
         │
    ┌────▼─────────────────┐
    │  Git Repository      │
    │  (GitHub, GitLab)    │
    └────┬─────────────────┘
         │
         │ git pull
         │
┌────────▼──────────────┐
│  Linux Server         │
│                       │
│  🔒 Secure execute   │
│  🛡️ VM isolation     │
│  Firecracker mode    │
│                      │
│  ./scripts/setup-... │
│  npm run build       │
│  firecracker-lambda  │
└──────────────────────┘
```

## Bundling Functions Once

A key advantage: **bundle once, run anywhere**

```bash
# On your Mac, build the bundle
npm run -w bundler build
node dist/bundler/cli.js examples/hello.ts -o dist/hello.js

# Bundle is now platform-independent
file dist/hello.js
# Output: JavaScript source, ASCII text

# Deploy to:
# - Local Node.js server ✅
# - Firecracker on Linux ✅
# - Kubernetes cluster ✅
# - AWS Lambda ✅
# - Cloudflare Workers ✅
```

## CI/CD Pipeline Example

```yaml
# .github/workflows/deploy.yml
name: Deploy Firecracker Functions

on: [push]

jobs:
  bundle:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci && npm run build
      
      - run: npm run -w bundler dev bundle examples/hello.ts -o dist/hello.js
      
      - uses: actions/upload-artifact@v3
        with:
          name: bundles
          path: dist/*.js

  deploy:
    runs-on: ubuntu-latest
    needs: bundle
    steps:
      - uses: actions/download-artifact@v3
        with:
          name: bundles
      
      - run: |
          ./scripts/setup-firecracker.sh
          firecracker-lambda deploy hello hello.js
          firecracker-lambda invoke hello '{"name":"CI"}'
```

## Testing Firecracker on Mac

### Option 1: Docker with Lima

[Lima](https://github.com/lima-vm/lima) lets you run Linux VMs on Mac:

```bash
# Install Lima
brew install lima

# Start Linux VM
limactl start default

# Inside the VM, install Firecracker
limactl shell default
./scripts/setup-firecracker.sh
npm run build
```

### Option 2: OrbStack

[OrbStack](https://orbstack.dev) is a faster alternative to Docker Desktop:

```bash
# Install OrbStack
brew install orbstack

# Enable Firecracker VM
orbstack config set firecracker enabled

# Build and test
npm run build
npm run dev
```

### Option 3: Vagrant

```bash
# Use provided Vagrantfile
vagrant up

# SSH into Linux VM
vagrant ssh

# Install and test Firecracker
./scripts/setup-firecracker.sh
npm run build
```

## Performance Expectations

### Local Mac Development
- Cold start: 5-20ms
- Memory per function: 10-30MB
- Suitable for: Development, testing, iteration

### Firecracker Linux Production
- Cold start: 50-200ms
- Memory per function: 150-200MB
- Suitable for: Production, multi-tenant workloads

### Optimization Trade-offs
| Aspect | Mac (Node.js) | Linux (Firecracker) |
|--------|---------------|-------------------|
| Cold start | ⚡ 5-20ms | 🟡 50-200ms |
| Memory | 💾 Small | 🔒 Isolated |
| Security | 🟡 Shared | ✅ Hardware isolated |
| Development | ✅ Fast | 🔧 Complex setup |
| Production | 🟡 Limited | ✅ Ideal |

## Recommendations

### For Development
Use **Node.js mode** on your Mac:
```bash
npm run dev  # Lightning fast iteration
```

### For Testing Firecracker
Use **Docker + Linux** locally:
```bash
docker run -it --privileged firecracker-lambda:latest bash
```

### For Production
Deploy bundles to **Linux servers** with Firecracker:
```bash
firecracker-lambda deploy <name> <bundle.js>
```

## Summary

| Scenario | Platform | Mode | Command |
|----------|----------|------|---------|
| **Local dev** | macOS | Node.js | `npm run dev` |
| **Test Firecracker** | Docker/Linux | Firecracker | `./scripts/setup-firecracker.sh` |
| **Production** | Linux Server | Firecracker | `firecracker-lambda invoke` |
| **Serverless** | AWS Lambda | Bundled | `sam deploy` |

The key insight: **develop locally with Node.js, deploy to Linux with Firecracker**.
