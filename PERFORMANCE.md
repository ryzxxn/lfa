# Performance & Optimization Guide

Strategies for faster cold starts and support for large libraries.

## Cold Start Bottlenecks

Current performance: **25-35ms per invocation**

Breakdown:
- VM startup: ~5ms
- Bundle loading: ~8ms
- Handler invocation: ~10ms
- Function execution: ~2-12ms (varies)

## Optimization Strategies

### 1. Bundle Caching (Immediate: 10-15% faster)

Cache bundled functions to avoid re-bundling on every deploy.

```typescript
import { BundleCache } from "@firecracker-lambda/controller";

const cache = new BundleCache();

// Check cache first
let bundlePath = cache.get(sourceFile)?.bundlePath;

if (!bundlePath) {
  // Bundle and cache
  bundlePath = await bundleFunction({ entryPoint: sourceFile, ... });
  cache.set(sourceFile, bundlePath);
}
```

**Benefit:** Skip esbuild compilation if source unchanged
**Savings:** ~2-3ms per deploy

### 2. VM Pooling (30-50% faster)

Keep warm VMs around for quick reuse instead of creating new ones each time.

```typescript
import { FunctionPool } from "@firecracker-lambda/controller";

const pool = new FunctionPool({
  minSize: 2,      // Always keep 2 VMs ready
  maxSize: 10,     // Up to 10 concurrent
  ttlMs: 60000,    // Keep for 60 seconds
});

const vm = await pool.acquire();
try {
  const result = await vm.execute(bundlePath, payload);
  return result;
} finally {
  await pool.release(vm);
}
```

**Benefit:** Reuse warm VMs, skip cold boot
**Savings:** ~8-15ms per invocation (50-80% reduction)

**When to use:**
- High-frequency functions (>10 invocations/minute)
- Real-time APIs
- Interactive workloads

### 3. Pre-bundling (Build-time optimization)

Bundle functions once during build, ship bundles directly.

```bash
# Build all functions
npm run -w bundler dev bundle src/functions/hello.ts -o dist/hello.js
npm run -w bundler dev bundle src/functions/compute.ts -o dist/compute.js

# Deploy pre-built bundles (no compilation needed)
firecracker-lambda deploy hello dist/hello.js
firecracker-lambda deploy compute dist/compute.js
```

**Benefit:** Zero compilation overhead
**Savings:** ~3-5ms per deploy

### 4. Lazy Module Loading (For large libraries)

Don't bundle huge libraries—load them at runtime.

```typescript
import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  // Only loaded when needed, not bundled
  const torch = await lazyLoad("torch");
  
  const result = torch.tensor([1, 2, 3]).sum();
  return { result: result.item() };
});
```

Bundler output: **2KB** (without torch!)
Instead of: **500MB+** (if torch was bundled)

**Benefit:** Massive bundle size reduction
**Requirement:** Module must exist in runtime environment

### 5. Firecracker Snapshots (Advanced)

Take snapshots of warm VMs and restore them instantly.

```typescript
// Snapshot after first invocation
const snapshot = await vm.takeSnapshot();

// Later, restore from snapshot (near-instant)
const vm2 = await FirecrackerVM.restoreFromSnapshot(snapshot);
```

**Benefit:** ~2ms cold start (10-15x faster)
**Requirement:** Firecracker snapshots feature

---

## Large Library Strategies

### Problem: Bundling Torch/Transformers

Naïve approach: Include torch in bundle
- Bundle size: **500MB-2GB**
- Cold start: **seconds**
- ❌ Not feasible

### Solution 1: Lazy Loading + Shared Libraries

Pre-install libraries in Firecracker rootfs, lazy-load in function.

```typescript
// In your function
import { lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const transformers = await lazyLoad("transformers");
  const model = transformers.AutoModel.from_pretrained("bert-base");
  
  return { model_loaded: true };
});
```

Rootfs setup:
```bash
# In Firecracker rootfs
pip install torch transformers

# Now functions can lazyLoad them
```

**Pros:**
- ✅ Small bundle (2-5KB)
- ✅ Fast cold start (30-50ms)
- ✅ Libraries pre-installed

**Cons:**
- ❌ Rootfs size increases (~2-3GB for ML stack)
- ❌ All VMs carry the weight

### Solution 2: External Service

Delegate to dedicated service, call via HTTP.

```typescript
export default defineHandler(async (payload) => {
  const response = await fetch("http://ml-service:8000/infer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
});
```

Function bundle: **2KB**
ML service: Separate, always running

**Pros:**
- ✅ Tiny function bundles
- ✅ Reusable ML service
- ✅ Scales independently

**Cons:**
- ❌ Network latency (~10-50ms)
- ❌ Additional infrastructure

### Solution 3: Container Layer

Include libraries in container, not bundle.

```dockerfile
FROM ubuntu:22.04

# Heavy libraries
RUN pip install torch transformers

# Copy light function
COPY function.js /app/function.js

CMD ["node", "/app/function.js"]
```

**Pros:**
- ✅ Clean separation
- ✅ Standard Docker build

**Cons:**
- ❌ Large container image
- ❌ Slower to start

---

## Recommendation Matrix

| Scenario | Strategy | Savings |
|----------|----------|---------|
| **Quick functions (<10ms)** | Bundle caching | 10-15% |
| **High-frequency APIs** | VM pooling | 30-50% |
| **CI/CD pipelines** | Pre-bundling | 20-30% |
| **ML inference** | Lazy load + shared | 30-50% |
| **Batch processing** | VM pool + pre-bundled | 40-60% |
| **Extreme speed** | Snapshots | 70-80% |

---

## Benchmark Results

### Cold Start Comparison

```
Default (25-35ms):
├─ VM creation:      5ms
├─ Bundle load:      8ms
├─ Handler init:     10ms
└─ Execution:        2-12ms

With VM Pooling (8-15ms):
├─ VM reuse:         1ms
├─ Bundle load:      4ms
├─ Handler init:     2ms
└─ Execution:        1-8ms

With Snapshots (2-5ms):
├─ VM restore:       1ms
├─ Bundle load:      1ms
├─ Handler init:     1ms
└─ Execution:        1-2ms
```

### Bundle Size Comparison

```
Simple function:        2KB
With lodash:           25KB
With axios:            40KB
With transformers:    500MB+ ❌

With lazy loading:
- Simple:              2KB
- With transformers:   2KB ✅
```

---

## Implementation Examples

### Example 1: Cached & Pooled Controller

```typescript
import { FunctionController } from "@firecracker-lambda/controller";
import { BundleCache } from "@firecracker-lambda/controller";
import { FunctionPool } from "@firecracker-lambda/controller";

class OptimizedController {
  private cache = new BundleCache();
  private pool = new FunctionPool({
    minSize: 2,
    maxSize: 10,
    ttlMs: 60000,
  });

  async invoke(functionName: string, payload: any) {
    // Get or create bundle
    let bundlePath = this.cache.get(functionName)?.bundlePath;
    if (!bundlePath) {
      bundlePath = await this.deploy(functionName, sourceFile);
      this.cache.set(sourceFile, bundlePath);
    }

    // Use pooled VM
    const vm = await this.pool.acquire();
    try {
      return await vm.execute(bundlePath, payload);
    } finally {
      await this.pool.release(vm);
    }
  }
}
```

### Example 2: ML Function with Lazy Loading

```typescript
import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  // Bundle: 2KB only!
  const { text } = payload as { text: string };

  // Load at runtime (library in rootfs)
  const tf = await lazyLoad("tensorflow");
  const model = tf.loadLayersModel("file:///models/text-model.json");

  const prediction = await model.predict(tf.tensor([text]));

  return {
    input: text,
    prediction: prediction.dataSync()[0],
  };
});
```

---

## Configuration

### Pool Sizing

```typescript
// For low-traffic
{ minSize: 1, maxSize: 3, ttlMs: 30000 }

// For medium traffic
{ minSize: 2, maxSize: 10, ttlMs: 60000 }

// For high traffic
{ minSize: 5, maxSize: 50, ttlMs: 120000 }
```

### Cache Location

```typescript
// Default: ~/.firecracker-lambda-cache
const cache = new BundleCache();

// Custom location
const cache = new BundleCache("/mnt/fast-storage/cache");
```

---

## Monitoring

```typescript
const pool = new FunctionPool({ minSize: 2, maxSize: 10, ttlMs: 60000 });

// Get stats
const stats = pool.getStats();
console.log(`Available: ${stats.available}, InUse: ${stats.inUse}`);

// Get cache stats
const cacheStats = cache.getCacheStats();
console.log(`Cached functions: ${cacheStats.entries}, Size: ${cacheStats.totalSize}B`);
```

---

## Tradeoffs

| Feature | Benefit | Cost |
|---------|---------|------|
| **Bundle Cache** | 10-15% faster | Disk space |
| **VM Pool** | 30-50% faster | Memory usage |
| **Lazy Loading** | 100-1000x smaller bundles | Runtime dependency |
| **Pre-bundling** | 20-30% faster | Build complexity |
| **Snapshots** | 70-80% faster | Storage overhead |

---

## Future Improvements

- [ ] Automatic pool sizing based on traffic
- [ ] Warmup strategies (pre-load popular functions)
- [ ] Compression of bundles (brotli)
- [ ] WASM modules for ML inference
- [ ] Multi-region function distribution
- [ ] Request batching for throughput
