# TypeScript-First Roadmap

**Decision:** Stay with TypeScript for now. Go rewrite can happen in 6-12 months if performance demands it.

---

## ✨ Why This is Smart

**Advantages:**
✅ Keep momentum going  
✅ Agents understand TypeScript  
✅ Faster iteration on AI features  
✅ Easier to modify/extend  
✅ Node.js is "good enough" for millions of functions  
✅ Can always rewrite later  

**Reality Check:**
- TypeScript handles 10K+ RPS fine
- Memory overhead is acceptable
- Bundling speed is acceptable
- Cold starts are already optimized

**Decision Point:**
- Only rewrite to Go if you hit actual bottlenecks
- Metrics will tell you when (spoiler: probably not for 1-2 years)

---

## 🎯 Phase 1 → Phase 2: AI Agent Features in TypeScript

### Next 6 Weeks: Build This (In Order)

#### Week 1-2: Function Registry
```typescript
// registry/index.ts
interface FunctionMetadata {
  id: string;
  name: string;
  description: string;
  inputs: JSONSchema;
  outputs: JSONSchema;
  examples: Example[];
  tags: string[];
  version: string;
  createdAt: Date;
  performance: {
    avgLatency: number;
    throughput: number;
  };
}

class FunctionRegistry {
  async register(metadata: FunctionMetadata): Promise<void>;
  async list(filters?: Filters): Promise<FunctionMetadata[]>;
  async get(id: string): Promise<FunctionMetadata>;
  async search(query: string): Promise<FunctionMetadata[]>;
  async update(id: string, updates: Partial<FunctionMetadata>): Promise<void>;
}

// API endpoints
POST /api/functions/register
GET /api/functions
GET /api/functions/:id
POST /api/functions/search
```

**Deliverables:**
- Store function metadata (SQLite)
- Query API for agents
- Schema generation from code

#### Week 2-3: Pipeline Composition
```typescript
// pipeline/index.ts
interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  description: string;
}

interface PipelineStep {
  functionId: string;
  inputs: Record<string, any>;
  onError?: "fail" | "ignore" | "retry";
}

class PipelineExecutor {
  async execute(pipeline: Pipeline, input: any): Promise<any>;
  async validate(pipeline: Pipeline): Promise<ValidationResult>;
  async getLineage(pipelineId: string): Promise<Lineage>;
}

// API endpoints
POST /api/pipelines/create
POST /api/pipelines/:id/execute
GET /api/pipelines/:id/lineage
```

**Deliverables:**
- Validate pipelines
- Execute step-by-step
- Track data flow

#### Week 3-4: Code Validation & Sandboxing
```typescript
// sandbox/index.ts
interface ExecutionConstraints {
  maxDuration: number;        // ms
  maxMemory: number;          // MB
  maxNetworkRequests: number;
  allowedDomains?: string[];
  canWriteFiles: boolean;
  canAccessEnv: boolean;
  canLoadModules: string[];   // Whitelist
}

class SandboxEnforcer {
  async validateCode(code: string): Promise<ValidationReport>;
  async injectConstraints(code: string, constraints: ExecutionConstraints): Promise<string>;
  async analyzeAST(code: string): Promise<Analysis>;
}

// API endpoints
POST /api/validate-code
POST /api/sandbox-constraints
```

**Deliverables:**
- AST analysis for safety
- Inject runtime guards
- Whitelist modules

#### Week 4-5: Versioning & A/B Testing
```typescript
// versioning/index.ts
interface FunctionVersion {
  functionId: string;
  version: string;
  code: string;
  performance: PerformanceMetrics;
  createdAt: Date;
  active: boolean;
}

class VersionManager {
  async deploy(functionId: string, code: string): Promise<FunctionVersion>;
  async promote(functionId: string, version: string): Promise<void>;
  async abTest(functionId: string, versionA: string, versionB: string, splitPercent: number): Promise<ABTestResult>;
  async rollback(functionId: string): Promise<void>;
}

// API endpoints
POST /api/functions/:id/deploy
POST /api/functions/:id/promote/:version
POST /api/functions/:id/ab-test
POST /api/functions/:id/rollback
```

**Deliverables:**
- Version tracking
- A/B testing framework
- Automatic rollback

#### Week 5-6: Observability & Metrics
```typescript
// observability/index.ts
interface FunctionMetrics {
  functionId: string;
  invocationCount: number;
  avgLatency: number;
  errorRate: number;
  p99Latency: number;
  throughput: number;
  modelDrift?: number;  // If ML model
}

class MetricsCollector {
  async record(invocation: Invocation): Promise<void>;
  async getMetrics(functionId: string, timeRange: TimeRange): Promise<FunctionMetrics>;
  async detectAnomaly(functionId: string): Promise<Anomaly | null>;
  async exportToDatadog(metrics: FunctionMetrics): Promise<void>;
}

// API endpoints
GET /api/functions/:id/metrics
GET /api/functions/:id/anomalies
```

**Deliverables:**
- Real-time metrics
- Anomaly detection
- Export to monitoring tools

---

## 📦 File Structure After Phase 2

```
firecracker-lambda/
├─ controller/
│  ├─ src/
│  │  ├─ index.ts           (orchestration)
│  │  ├─ vm.ts              (VM management)
│  │  ├─ server.ts          (API server)
│  │  ├─ registry.ts        ← NEW: Function registry
│  │  ├─ pipeline.ts        ← NEW: Composition
│  │  ├─ sandbox.ts         ← NEW: Safety
│  │  ├─ versioning.ts      ← NEW: A/B testing
│  │  └─ observability.ts   ← NEW: Metrics
│  └─ tests/
│     ├─ registry.test.ts
│     ├─ pipeline.test.ts
│     ├─ sandbox.test.ts
│     └─ observability.test.ts
│
├─ examples/
│  ├─ sentiment-analysis.ts
│  ├─ text-embedding.ts
│  ├─ text-classification.ts
│  ├─ ai-pipeline-example.ts    ← NEW: Agent composition
│  └─ ai-generated-function.ts  ← NEW: Dynamic generation
│
└─ docs/
   ├─ REGISTRY_API.md          ← NEW
   ├─ PIPELINE_GUIDE.md        ← NEW
   ├─ SANDBOX_SAFETY.md        ← NEW
   └─ VERSIONING_GUIDE.md      ← NEW
```

---

## 🤖 What Agents Can Do After Phase 2

### Scenario 1: Discover & Reuse
```
Agent: "What sentiment functions exist?"
  ↓
GET /api/functions?tag=sentiment
  ↓
Agent: "Show me sentiment-v2 schema"
  ↓
GET /api/functions/sentiment-v2/schema
  ↓
Agent understands inputs/outputs
  ↓
Agent invokes: POST /api/invoke/sentiment-v2
```

### Scenario 2: Compose Functions
```
Agent: "Chain sentiment → classify → summarize"
  ↓
POST /api/pipelines/create
{
  steps: [
    { functionId: "sentiment", ... },
    { functionId: "classify", ... },
    { functionId: "summarize", ... }
  ]
}
  ↓
Pipeline validates & executes
  ↓
Agent gets lineage: sentiment → classify → summarize
```

### Scenario 3: Generate & Deploy
```
Agent: "Create improved sentiment function"
  ↓
Generates sentiment-v2.ts
  ↓
POST /api/validate-code
  ↓
Code validated, injected with constraints
  ↓
POST /api/functions/sentiment/deploy
  ↓
sentiment-v2 deployed
  ↓
A/B test: v1 (50%) vs v2 (50%)
  ↓
If v2 better → promote
```

---

## 💾 Storage & Persistence

### What to Store

```typescript
// SQLite database (simple, embedded)
database.db
├─ functions (table)
│  ├─ id
│  ├─ name
│  ├─ description
│  ├─ schema (JSON)
│  ├─ tags
│  └─ version
│
├─ pipelines (table)
│  ├─ id
│  ├─ name
│  ├─ steps (JSON)
│  └─ created_at
│
├─ function_versions (table)
│  ├─ function_id
│  ├─ version
│  ├─ code (gzipped)
│  ├─ metrics (JSON)
│  └─ active (boolean)
│
├─ invocations (table)
│  ├─ id
│  ├─ function_id
│  ├─ duration
│  ├─ status
│  ├─ error (nullable)
│  └─ timestamp
│
└─ metrics (table)
   ├─ function_id
   ├─ period
   ├─ avg_latency
   ├─ error_rate
   └─ throughput
```

---

## 📊 TypeScript Packages You'll Need

```json
{
  "dependencies": {
    "@firecracker-lambda/framework": "^0.1.0",
    "@firecracker-lambda/bundler": "^0.1.0",
    "@firecracker-lambda/controller": "^0.1.0",
    "sqlite3": "^5.1.0",
    "joi": "^17.9.0",
    "typescript-json-schema": "^0.50.0"
  }
}
```

---

## 🧪 Testing Strategy

```typescript
// registry.test.ts
describe("FunctionRegistry", () => {
  it("registers function metadata", async () => {
    const registry = new FunctionRegistry();
    await registry.register(mockMetadata);
    
    const retrieved = await registry.get(mockMetadata.id);
    expect(retrieved).toEqual(mockMetadata);
  });
  
  it("searches by tag", async () => {
    const functions = await registry.list({ tags: ["nlp"] });
    expect(functions.length).toBeGreaterThan(0);
  });
});

// pipeline.test.ts
describe("PipelineExecutor", () => {
  it("validates pipeline connections", async () => {
    const result = await executor.validate(invalidPipeline);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid connection");
  });
  
  it("executes pipeline steps in order", async () => {
    const result = await executor.execute(validPipeline, input);
    expect(result).toBeDefined();
  });
});

// sandbox.test.ts
describe("SandboxEnforcer", () => {
  it("rejects unsafe code", async () => {
    const unsafeCode = "require('fs').unlinkSync('/etc/passwd')";
    const result = await enforcer.validateCode(unsafeCode);
    expect(result.safe).toBe(false);
  });
  
  it("injects timeout guards", async () => {
    const injected = await enforcer.injectConstraints(code, {
      maxDuration: 5000
    });
    expect(injected).toContain("setTimeout");
  });
});
```

---

## 📈 Performance Expectations (TypeScript)

```
Registry lookup:        2-5ms
Pipeline validation:    5-10ms
Code analysis:          10-50ms (AST parsing)
Function invocation:    30-50ms (with pooling)
Metrics query:          5-10ms (SQLite)

Throughput:             10K+ RPS (Node.js is fine)
Memory per function:    10-20MB (acceptable)
```

**When to consider Go:**
- Registry queries > 10ms consistently
- Bundling > 100ms on large projects
- Throughput needs > 100K RPS
- Memory per function > 50MB

**Verdict:** TypeScript is fine for 2+ years at scale.

---

## 🚀 Week-by-Week Execution

```
Week 1-2: Registry
├─ Monday: Design schema
├─ Tuesday: Implement registry class
├─ Wednesday: Add SQLite persistence
├─ Thursday: REST API endpoints
└─ Friday: Tests + documentation

Week 2-3: Pipeline
├─ Monday: Design pipeline format
├─ Tuesday: Implement executor
├─ Wednesday: Validation logic
├─ Thursday: API endpoints
└─ Friday: Tests + examples

Week 3-4: Sandbox
├─ Monday: Learn AST analysis
├─ Tuesday: Build code validator
├─ Wednesday: Constraint injection
├─ Thursday: API endpoints
└─ Friday: Tests + security audit

Week 4-5: Versioning
├─ Monday: Design version storage
├─ Tuesday: Implement version manager
├─ Wednesday: A/B testing framework
├─ Thursday: API endpoints
└─ Friday: Tests + rollback logic

Week 5-6: Observability
├─ Monday: Design metrics schema
├─ Tuesday: Implement metrics collector
├─ Wednesday: Anomaly detection
├─ Thursday: Integrations (Datadog, etc)
└─ Friday: Tests + dashboards
```

---

## ✅ Success Criteria

After Phase 2, you should have:

```
Registry:
✅ 1000+ discoverable functions
✅ <5ms lookup time
✅ Tag/capability filtering

Pipelines:
✅ 5+ step compositions
✅ Automatic validation
✅ <1s execution time

Sandbox:
✅ 99% safety detection rate
✅ <50ms constraint injection
✅ Zero unsafe code execution

Versioning:
✅ Rollback in <1s
✅ A/B test framework
✅ Automatic promotion logic

Observability:
✅ Real-time metrics
✅ Anomaly detection
✅ <10ms query time
```

---

## 💡 Key Insights

**TypeScript is perfect for:**
- AI agent infrastructure
- Rapid iteration
- Readable code
- Easy testing

**Don't overthink performance:**
- Node.js handles millions of requests
- Memory is cheap
- Add Go layer later if needed
- Metrics will tell you when

**Focus on:**
- Agent capabilities (registry, pipelines)
- Safety (sandboxing)
- Reliability (versioning, observability)
- User experience

**Ship first, optimize later.**

---

## 🎯 Your Next Action

Pick Week 1 task:
1. Design FunctionRegistry schema
2. Set up SQLite
3. Implement registry class
4. Create REST endpoints
5. Write tests

Start Monday. Ship by Friday.

Let's build this! 🚀
