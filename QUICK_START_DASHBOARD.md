# Quick Start: Dashboard & Environment Variables

## Start the Dashboard

```bash
cd controller
npm run build  # Build TypeScript
npm run start  # Start server on http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## Example 1: Simple Echo Function

### Deploy
1. **Function Name:** `echo`
2. **Code:**
```typescript
export default defineHandler(async (payload: { message: string }) => {
  return { echo: payload.message };
});
```
3. Click **Deploy Function**

### Invoke
1. Select `echo` from dropdown
2. **Payload:**
```json
{ "message": "Hello, World!" }
```
3. Click **Invoke**
4. **Result:**
```json
{ "echo": "Hello, World!" }
```

---

## Example 2: API Call with Environment Variables

### Deploy with Secrets
1. **Function Name:** `api-caller`
2. **Code:**
```typescript
import { defineHandler, getEnv } from "@firecracker-lambda/framework";

export default defineHandler(async (payload: { endpoint: string }) => {
  const apiKey = getEnv("API_KEY");
  const timeout = getEnv("TIMEOUT", "5000");

  if (!apiKey) {
    throw new Error("API_KEY environment variable not set");
  }

  return {
    message: "Would call API",
    endpoint: payload.endpoint,
    hasApiKey: !!apiKey,
    timeout: parseInt(timeout)
  };
});
```

3. **Environment Variables:**
   - KEY: `API_KEY` VALUE: `secret-key-xyz`
   - KEY: `TIMEOUT` VALUE: `10000`

4. Click **Deploy Function**

### Invoke
1. Select `api-caller`
2. **Payload:**
```json
{ "endpoint": "/users" }
```
3. Click **Invoke**
4. **Result:**
```json
{
  "message": "Would call API",
  "endpoint": "/users",
  "hasApiKey": true,
  "timeout": 10000
}
```

---

## Example 3: Override Environment at Invocation

Deploy a function with base configuration, then override at invocation time:

### Deploy
```typescript
import { defineHandler, getEnv } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const environment = getEnv("ENVIRONMENT", "development");
  const logLevel = getEnv("LOG_LEVEL", "info");

  return {
    environment,
    logLevel,
    timestamp: new Date().toISOString()
  };
});
```

**Name:** `config-checker`  
**Environment Variables:**
- `ENVIRONMENT`: `production`
- `LOG_LEVEL`: `warn`

### Invoke with Override

**Using cURL to override at invocation:**
```bash
curl -X POST http://localhost:3000/api/invoke/config-checker \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {},
    "env": {
      "ENVIRONMENT": "staging",
      "LOG_LEVEL": "debug"
    }
  }'
```

**Result:** (uses staging/debug, not production/warn)
```json
{
  "result": {
    "environment": "staging",
    "logLevel": "debug",
    "timestamp": "2026-10-03T..."
  }
}
```

---

## API Examples

### Deploy via API

```bash
curl -X POST http://localhost:3000/api/functions/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-function",
    "code": "export default defineHandler(async (payload) => { return { ok: true }; })",
    "env": {
      "DB_HOST": "localhost",
      "DB_PORT": "5432"
    }
  }'
```

### List Functions

```bash
curl http://localhost:3000/api/functions
```

**Response:**
```json
[
  {
    "id": "echo",
    "name": "echo",
    "deployedAt": 1696346400000
  },
  {
    "id": "api-caller",
    "name": "api-caller",
    "deployedAt": 1696346500000
  }
]
```

### Invoke via API

```bash
curl -X POST http://localhost:3000/api/invoke/echo \
  -H "Content-Type: application/json" \
  -d '{
    "payload": { "message": "API test" },
    "env": { "DEBUG": "true" }
  }'
```

### Get Metrics

```bash
curl http://localhost:3000/api/metrics/functions/echo/stats
```

**Response:**
```json
{
  "functionId": "echo",
  "timestamp": 1696346600000,
  "stats": {
    "avgDuration": 45,
    "minDuration": 35,
    "maxDuration": 120,
    "errorRate": 0,
    "coldStartRate": 0
  }
}
```

---

## Environment Variables: Best Practices

### 1. Secrets
```typescript
const dbPassword = getEnv("DB_PASSWORD");
const apiKey = getEnv("API_KEY");
// Never log or return these!
```

### 2. Configuration
```typescript
const maxRetries = parseInt(getEnv("MAX_RETRIES", "3"));
const timeout = parseInt(getEnv("TIMEOUT", "5000"));
const logLevel = getEnv("LOG_LEVEL", "info");
```

### 3. Feature Flags
```typescript
const betaFeatureEnabled = getEnv("ENABLE_BETA") === "true";
if (betaFeatureEnabled) {
  // Use new experimental code
}
```

### 4. Fallback Defaults
```typescript
// Use deployment env, fallback to default
const region = getEnv("AWS_REGION", "us-east-1");
const bucket = getEnv("S3_BUCKET", "default-bucket");
```

---

## Troubleshooting

### Function won't deploy
- Check TypeScript syntax
- Ensure `export default` is present
- Verify imports are valid

### Invocation fails
- Check if function is selected
- Verify JSON payload is valid
- Check environment variables are set

### Missing environment variable
```typescript
const value = getEnv("MY_VAR");
if (!value) {
  throw new Error("MY_VAR not set");
}
```

---

## What's Next?

- ✅ Deploy functions from dashboard
- ✅ Set environment variables
- ✅ View metrics
- 🚀 Build pipelines (chain functions)
- 🚀 Add monitoring/alerting
- 🚀 Create AI agent integrations

---

**Dashboard:** http://localhost:3000  
**API Base:** http://localhost:3000/api
