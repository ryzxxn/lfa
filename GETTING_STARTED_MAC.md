# Getting Started on macOS

Complete walkthrough to get Firecracker Lambda running on your Mac.

## 5-Minute Setup

### Step 1: Clone and Install

```bash
cd /Users/eltoncosta/coderepo/firecracker-lambda
npm install
npm run build
```

### Step 2: Deploy Your First Function

```bash
npm run -w controller dev deploy hello examples/hello.ts
```

You should see:
```
✓ Bundled examples/hello.ts → ... (2.3KB)
✅ Deployed hello
```

### Step 3: Invoke It

```bash
npm run -w controller dev invoke hello '{"name":"Alice"}'
```

Expected output:
```json
{
  "result": {
    "message": "Hello, Alice!",
    "timestamp": "2024-10-03T..."
  },
  "duration": 42
}
```

**Congratulations!** 🎉 You have a working serverless runtime.

## Understanding What Happened

```
1. You wrote:    examples/hello.ts
   ↓
2. Framework:    Imported @firecracker-lambda/framework
   ↓
3. Bundler:      esbuild bundled → 2.3KB
   ↓
4. Controller:   Stored bundle
   ↓
5. Runtime:      Loaded & executed function
   ↓
6. Result:       "Hello, Alice!"
   ↓
7. Cleanup:      Process exited, memory freed
```

**Key insight:** The bundled code contains ONLY what's needed, nothing more.

## Next Steps

### 1. Write Your Own Function

Create `my-math.ts`:

```typescript
import { defineHandler } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { a, b } = payload as { a: number; b: number };
  
  if (a === undefined || b === undefined) {
    throw new Error("Expected a and b parameters");
  }
  
  return {
    sum: a + b,
    product: a * b,
    average: (a + b) / 2,
  };
});
```

Deploy it:
```bash
npm run -w controller dev deploy math my-math.ts
```

Test it:
```bash
npm run -w controller dev invoke math '{"a":10,"b":20}'
```

### 2. Use External Libraries

Create `data-processor.ts`:

```typescript
import { defineHandler } from "@firecracker-lambda/framework";

// You can import from node_modules
import * as crypto from "crypto";

export default defineHandler(async (payload) => {
  const { text } = payload as { text: string };
  
  const hash = crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
  
  return {
    original: text,
    hash,
    length: text.length,
  };
});
```

Deploy and test:
```bash
npm run -w controller dev deploy processor data-processor.ts
npm run -w controller dev invoke processor '{"text":"hello world"}'
```

**Tree-shaking magic:** Only the `crypto` code you actually use gets bundled. The bundle is still tiny! ✨

### 3. Deploy Multiple Functions

```bash
# Deploy several functions
npm run -w controller dev deploy func1 functions/func1.ts
npm run -w controller dev deploy func2 functions/func2.ts
npm run -w controller dev deploy func3 functions/func3.ts

# List all deployed functions
npm run -w controller dev list
```

Output:
```
Deployed functions:
  - hello
  - math
  - processor
  - func1
  - func2
  - func3
```

## How It Works (Under the Hood)

### 1. Bundling

```bash
npm run -w bundler dev bundle myfunction.ts --out dist/bundle.js
```

Uses esbuild to:
- ✅ Compile TypeScript to JavaScript
- ✅ Tree-shake unused code
- ✅ Minify output
- ✅ Create minimal, self-contained bundle

**Result:** A single `.js` file ready to execute anywhere.

### 2. Execution

The controller loads your bundle and runs it in a lightweight Node.js process:

```
Host Process
└── Load bundle.js
└── Find handler export
└── Call handler(payload)
└── Return result
└── Exit
```

No VMs, no containers—just pure JavaScript execution.

### 3. Cleanup

After the function finishes:
- Memory is freed
- Process exits
- Resources are cleaned up

**Cost model:** You only pay for what you use (execution time + memory).

## Tree-Shaking Example

### What You Write

```typescript
import { defineHandler } from "@firecracker-lambda/framework";
import * as lodash from "lodash";  // 50KB library

export default defineHandler(async (payload) => {
  const { items } = payload;
  return {
    first: lodash.first(items),  // Only use 1 function
    last: lodash.last(items),
  };
});
```

### What Gets Bundled

```javascript
// Only the tree-shaken code:
function first(array) { return array[0]; }
function last(array) { return array[array.length - 1]; }

// Handler code
async function handler(payload) {
  return {
    first: first(payload.items),
    last: last(payload.items),
  };
}
```

**Bundle size:** ~2KB (not 50KB!)

## Development Tips

### Hot Reloading

```bash
# Terminal 1: Watch for changes
npm run -w bundler dev

# Terminal 2: Keep running commands
npm run -w controller dev invoke hello '{"name":"World"}'

# Terminal 3: Edit your function
# examples/hello.ts → save
# Bundle automatically rebuilds

# Deploy updated version
npm run -w controller dev deploy hello examples/hello.ts
```

### Debugging

Add console output:

```typescript
export default defineHandler(async (payload) => {
  console.log("Received payload:", payload);
  const result = compute(payload);
  console.log("Computed result:", result);
  return result;
});
```

Invoke and check output:
```bash
npm run -w controller dev invoke hello '{"x":5}'
```

### Performance Testing

Time your functions:

```bash
# The controller shows duration automatically
npm run -w controller dev invoke math '{"a":100,"b":200}'

# Output includes:
# "duration": 42  // milliseconds
```

## Ready for Production?

### Option 1: Stay on macOS

Use Node.js mode (what you're doing now):
- ✅ Fast development
- ✅ Works on any OS
- ✅ Easy to test
- ❌ Not isolated for multi-tenant use

### Option 2: Deploy to Linux with Firecracker

See [Deployment Guide](DEPLOYMENT_GUIDE.md):
- ✅ Hardware isolation (KVM)
- ✅ Multi-tenant safe
- ✅ Production-grade
- ❌ Slightly higher cold start

## Common Questions

### Q: Will my functions work on Linux too?

**A:** Yes! Bundles are platform-independent JavaScript. Deploy the same bundle to:
- Mac (Node.js) ✅
- Linux (Firecracker) ✅
- AWS Lambda ✅
- Any Node.js runtime ✅

### Q: How big can functions be?

**A:** Tree-shaking keeps bundles small:
- Hello world: ~2KB
- With crypto: ~5KB
- With complex logic: ~10-50KB

Typical: **under 100KB**

### Q: Can I use npm packages?

**A:** Yes! Any npm package that:
- Works with Node.js
- Doesn't require native bindings
- Doesn't use browser APIs

Bad packages:
- React (browser-only)
- `node-sqlite3` (native binding)
- `@browser/something`

Good packages:
- `lodash` ✅
- `date-fns` ✅
- `crypto` ✅
- `uuid` ✅

### Q: What about dependencies?

**A:** They get bundled automatically:

```typescript
import _ from "lodash";  // Gets bundled

export default defineHandler(async (payload) => {
  return { result: _.sum(payload.items) };
});
```

The bundler:
1. Analyzes imports
2. Includes only what's needed
3. Creates single `.js` file

No separate dependency management needed!

### Q: How do I handle errors?

**A:** Throw errors in your handler—they're caught automatically:

```typescript
export default defineHandler(async (payload) => {
  if (!payload.required_field) {
    throw new Error("Missing required_field");
  }
  return { success: true };
});
```

Response:
```json
{
  "error": "Missing required_field",
  "duration": 5
}
```

## Resources

| Document | Purpose |
|----------|---------|
| [MAC_DEVELOPMENT.md](MAC_DEVELOPMENT.md) | Detailed macOS dev guide |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Deploy to Linux/Firecracker |
| [README.md](README.md) | Project overview |
| [FIRECRACKER_INTEGRATION.md](FIRECRACKER_INTEGRATION.md) | Firecracker deep dive |

## Next Actions

1. **Now:** Deploy `examples/hello.ts` and `examples/compute.ts`
2. **Soon:** Write your own function
3. **Next:** Explore [MAC_DEVELOPMENT.md](MAC_DEVELOPMENT.md) for advanced topics
4. **Later:** Deploy to Linux with Firecracker when ready

## Summary

✅ **Quick start:** `npm run build && npm run -w controller dev deploy hello examples/hello.ts`  
✅ **Node.js mode:** Perfect for macOS development  
✅ **Tree-shaking:** Minimal bundles with only needed code  
✅ **Easy iteration:** Fast feedback loop  
🔒 **Future:** Deploy to Firecracker on Linux for security  

You now have a complete serverless function platform right on your Mac!
