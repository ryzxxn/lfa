# ML Workloads Guide

Running PyTorch, TensorFlow, and transformers with Firecracker Lambda.

## Challenge: ML Libraries are Huge

```
torch:              2.5GB
tensorflow:         2.2GB
transformers:       1.5GB
numpy:              300MB
pandas:             200MB

Bundling all:       6+GB ❌
Cold start:         Minutes ❌
```

## Solution: Shared Library Layer

Pre-install ML libraries in Firecracker rootfs. Functions lazy-load them.

```
Bundle:             2KB ✅
Cold start:         30-50ms ✅
```

---

## Setup: Build ML-Ready Rootfs

### Step 1: Create Custom Rootfs

```bash
# Create a larger rootfs with ML libraries
./scripts/build-ml-rootfs.sh --size 4GB

# This creates: ./kernels/rootfs-ml.ext4
# With: torch, tensorflow, transformers, numpy, pandas
```

### Step 2: Start Firecracker VM with ML Rootfs

```typescript
const vm = new FirecrackerVM({
  kernelPath: "./kernels/vmlinux-5.10",
  rootfsPath: "./kernels/rootfs-ml.ext4",  // ML libraries included
  memMB: 2048,  // ML needs more memory
  vcpuCount: 4,
});

await vm.initialize();
```

### Step 3: Write Function that Lazy-Loads

```typescript
// ml-sentiment.ts - Bundle size: 2KB
import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { text } = payload as { text: string };

  // Lazy load from shared libraries
  const transformers = await lazyLoad("transformers");

  const pipeline = transformers.pipeline(
    "sentiment-analysis",
    { model: "distilbert-base-uncased-finetuned-sst-2-english" }
  );

  const result = await pipeline(text);

  return {
    text,
    sentiment: result[0],
  };
});
```

Deploy & invoke:
```bash
npm run -w controller dev deploy sentiment ml-sentiment.ts

curl -X POST http://localhost:3000/invoke/sentiment \
  -H "Content-Type: application/json" \
  -d '{"text":"This is amazing!"}' | jq .
```

Output:
```json
{
  "text": "This is amazing!",
  "sentiment": {
    "label": "POSITIVE",
    "score": 0.9997
  }
}
```

---

## Real-World Examples

### Example 1: Image Classification

```typescript
// image-classifier.ts
import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { imageUrl } = payload as { imageUrl: string };

  // Lazy load
  const torch = await lazyLoad("torch");
  const torchvision = await lazyLoad("torchvision");

  // Download & process image
  const response = await fetch(imageUrl);
  const buffer = await response.buffer();

  // Inference
  const model = torchvision.models.resnet50({ pretrained: true });
  model.eval();

  // ... process image, run inference

  return {
    imageUrl,
    predictions: [
      { class: "dog", confidence: 0.95 },
      { class: "puppy", confidence: 0.03 },
    ],
  };
});
```

**Bundle:** 2KB  
**Inference:** 200-500ms (including model loading)

### Example 2: Text Embedding

```typescript
// embeddings.ts
import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { texts } = payload as { texts: string[] };

  // Lazy load sentence transformers
  const st = await lazyLoad("sentence_transformers");

  const model = st.SentenceTransformer("all-MiniLM-L6-v2");
  const embeddings = model.encode(texts);

  return {
    texts,
    embeddings: embeddings.tolist(),
    dimension: embeddings.shape[1],
  };
});
```

**Bundle:** 2KB  
**Embeddings:** 50-100ms per text

### Example 3: LLM Inference

```typescript
// llm-inference.ts
import { defineHandler, lazyLoad } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { prompt } = payload as { prompt: string };

  // Lazy load LLM library
  const transformers = await lazyLoad("transformers");

  // Use smaller model for efficiency
  const pipe = transformers.pipeline(
    "text-generation",
    { model: "gpt2" }
  );

  const generated = await pipe(prompt, { max_length: 100 });

  return {
    prompt,
    generated_text: generated[0].generated_text,
  };
});
```

**Bundle:** 2KB  
**Generation:** 500-2000ms (model-dependent)

---

## Performance Tuning for ML

### Memory Management

```typescript
// For memory-heavy models, increase VM memory
const vm = new FirecrackerVM({
  memMB: 4096,  // 4GB for large models
  vcpuCount: 8,
});
```

### Model Caching

```typescript
// Cache loaded models across invocations
const modelCache = new Map();

export default defineHandler(async (payload) => {
  const { modelName } = payload;

  let model = modelCache.get(modelName);
  if (!model) {
    const torch = await lazyLoad("torch");
    model = torch.jit.load(`/models/${modelName}.pt`);
    modelCache.set(modelName, model);
  }

  // Use cached model
  const output = model(input);
  return { output };
});
```

**Benefit:** 2x-5x faster subsequent invocations

### Batch Processing

```typescript
// Process multiple inputs in one invocation
export default defineHandler(async (payload) => {
  const { inputs } = payload as { inputs: string[] };

  const torch = await lazyLoad("torch");
  const model = torch.load("/models/classifier.pt");

  // Batch inference
  const embeddings = model(inputs);

  return {
    count: inputs.length,
    embeddings,
    time_per_sample: elapsed / inputs.length,
  };
});
```

---

## Deployment Strategies

### Strategy 1: Pre-built ML Rootfs

Best for: Static model requirements

```bash
# Build rootfs with all needed libraries
./scripts/build-ml-rootfs.sh \
  --packages torch,transformers,pytorch,spacy \
  --models bert-base,gpt2 \
  --size 5GB

# Deploy function that uses them
npm run -w controller dev deploy nlp ml-sentiment.ts
```

### Strategy 2: Dynamic Model Loading

Best for: Changing models frequently

```typescript
export default defineHandler(async (payload) => {
  const { modelUrl } = payload;

  // Download model dynamically
  const response = await fetch(modelUrl);
  const buffer = await response.buffer();

  const torch = await lazyLoad("torch");
  const model = torch.jit.load(buffer);

  // Inference
  return { result };
});
```

### Strategy 3: Hybrid (Recommended)

Pre-install core libraries, download specific models:

```bash
# Rootfs has: torch, transformers, etc.
./scripts/build-ml-rootfs.sh --size 4GB

# Models downloaded per request
curl -X POST http://localhost:3000/invoke/classifier \
  -d '{"modelUrl":"s3://models/bert-v2.pt"}'
```

---

## Resource Requirements

| Task | Memory | vCPUs | Duration |
|------|--------|-------|----------|
| Sentiment analysis | 1GB | 2 | 100-200ms |
| Image classification | 2GB | 4 | 500-1000ms |
| Text embeddings | 512MB | 2 | 100-300ms |
| LLM inference | 4GB | 8 | 1-5s |
| Fine-tuning | 8GB | 16 | 10-60s |

---

## Cost Estimation (AWS Lambda equivalent)

### Traditional Lambda

```
Per invocation:   $0.0000002
Per GB-second:    $0.0000166
Memory:           128MB-10GB

For 1000 sentiment invocations (2GB, 200ms):
= 1000 × 0.0000002 + (1000 × 0.2 × 2 × 0.0000166)
= $0.0002 + $0.0066
= ~$0.0068
```

### Firecracker Lambda (Self-hosted)

```
VM cost:          Negligible (your hardware)
Memory:           Always available
Execution:        2GB × 200ms × 1000 = pay for compute only

1000 invocations = ~$0.001-0.003 (electricity)
```

**Savings:** 70-95% cheaper for ML workloads

---

## Troubleshooting

### "Module not found" Error

```
Error: Cannot find module 'transformers'
```

**Solution:**
1. Verify ML libraries in rootfs: `pip list` inside VM
2. Use correct lazy-load: `await lazyLoad("transformers")`
3. Ensure rootfs path is correct

### Out of Memory

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Solutions:**
1. Increase VM memory: `memMB: 4096`
2. Use smaller models
3. Batch fewer items
4. Cache models properly

### Slow Inference

```
Expected 200ms, got 3000ms
```

**Causes:**
1. First invocation loads model (normal)
2. Model too large for VM memory
3. Batch size too large

**Solutions:**
1. Warm up before production
2. Use smaller models
3. Reduce batch size

---

## Best Practices

### ✅ DO:

- Pre-load commonly used models
- Cache models in memory
- Use smaller models for faster inference
- Batch multiple inputs when possible
- Monitor memory usage
- Set appropriate timeouts

### ❌ DON'T:

- Bundle ML libraries in function code
- Load models on every invocation (cache them)
- Use GPU-only models without GPU support
- Try to run models larger than available memory
- Ignore cold start for user-facing APIs

---

## Future Optimizations

- [ ] GPU support (NVIDIA CUDA)
- [ ] Model quantization (int8, fp16)
- [ ] ONNX runtime for cross-platform inference
- [ ] Model marketplace/registry
- [ ] Automatic model caching
- [ ] Distributed inference across pools

---

## Links & Resources

- [PyTorch Documentation](https://pytorch.org/docs)
- [Hugging Face Transformers](https://huggingface.co/transformers)
- [TensorFlow Serving](https://www.tensorflow.org/tfx/serving/overview)
- [ONNX Runtime](https://onnxruntime.ai)
