# Firecracker Lambda Dashboard

Web UI for managing and invoking serverless functions with minimal overhead.

## Start the Dashboard

```bash
cd controller
npm run start
```

The dashboard will be available at: **http://localhost:3000**

## Features

### 🚀 Deploy Functions

Deploy TypeScript functions directly from the UI:

1. Enter function name (e.g., `sentiment-analysis`)
2. Paste your TypeScript code
3. Add environment variables (optional)
4. Click "Deploy Function"

**Environment Variables at Deployment:**
You can set environment variables that are always available to the function:

```javascript
{
  "API_KEY": "secret-key-123",
  "SERVICE_URL": "https://api.example.com"
}
```

### ⚡ Invoke Functions

1. Select function from dropdown
2. Enter JSON payload
3. Click "Invoke"
4. View results instantly

**Example Payload:**
```json
{
  "text": "This movie is amazing!",
  "action": "analyze"
}
```

### 📊 Monitor Metrics

View performance stats for each function:
- Average duration
- Min/max latency
- Error rate
- Cold start percentage

### 🔧 Environment Variables

Variables can be set at two levels:

**1. At Deployment (persistent):**
```
[Deploy Function Form]
├─ Environment Variables
│  ├─ KEY: "API_KEY" VALUE: "secret123"
│  ├─ KEY: "DB_HOST" VALUE: "localhost"
```

**2. At Invocation (per-call override):**
```bash
curl -X POST http://localhost:3000/api/invoke/my-function \
  -H "Content-Type: application/json" \
  -d '{
    "payload": { "data": "test" },
    "env": {
      "DEBUG": "true",
      "OVERRIDE_KEY": "temp-value"
    }
  }'
```

### Access Environment Variables in Code

```typescript
import { defineHandler, getEnv } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  // Get from deployment or invocation env
  const apiKey = getEnv("API_KEY");
  const debug = getEnv("DEBUG") === "true";
  const dbHost = getEnv("DB_HOST", "default-host");
  
  return { apiKey, debug, dbHost };
});
```

## API Endpoints

All endpoints use `/api` prefix:

### Deploy
```bash
POST /api/functions/deploy
Content-Type: application/json

{
  "name": "my-function",
  "code": "export default defineHandler(async (payload) => { ... })",
  "env": {
    "API_KEY": "secret",
    "DB_URL": "postgres://..."
  }
}
```

### List Functions
```bash
GET /api/functions
```

### Invoke
```bash
POST /api/invoke/my-function
Content-Type: application/json

{
  "payload": { "data": "test" },
  "env": { "DEBUG": "true" }
}
```

### Get Metrics
```bash
GET /api/metrics/functions/my-function/stats
```

### Health Check
```bash
GET /api/health
```

## Example Workflow

### 1. Deploy a sentiment analyzer

```typescript
import { defineHandler, getEnv } from "@firecracker-lambda/framework";

export default defineHandler(async (payload: { text: string }) => {
  const apiKey = getEnv("SENTIMENT_API_KEY");
  
  if (!apiKey) {
    throw new Error("SENTIMENT_API_KEY not set");
  }

  const response = await fetch("https://sentiment-api.example.com/analyze", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ text: payload.text })
  });

  const result = await response.json();
  return {
    text: payload.text,
    sentiment: result.sentiment,
    score: result.score
  };
});
```

**Deploy with credentials:**
```
Name: sentiment-analyzer
Code: [paste above code]
Environment Variables:
  SENTIMENT_API_KEY: your-api-key
```

### 2. Invoke the function

**Payload:**
```json
{
  "text": "This product exceeded my expectations!"
}
```

**Result:**
```json
{
  "text": "This product exceeded my expectations!",
  "sentiment": "positive",
  "score": 0.95
}
```

### 3. Check metrics

Click "Get Metrics" to see:
- Average latency
- Error rate
- Cold start frequency
- Min/max duration

## Advanced: Environment Variable Patterns

### Pattern 1: Configuration from Environment
```typescript
export default defineHandler(async (payload) => {
  const env = {
    apiUrl: getEnv("API_URL", "https://default.api.com"),
    timeout: parseInt(getEnv("TIMEOUT", "5000")),
    retries: parseInt(getEnv("RETRIES", "3")),
    debug: getEnv("DEBUG") === "true"
  };
  
  return { config: env };
});
```

### Pattern 2: Secrets Management
```typescript
export default defineHandler(async (payload) => {
  const secrets = {
    database_url: getEnv("DATABASE_URL"),
    api_key: getEnv("API_KEY"),
    signing_key: getEnv("JWT_SECRET")
  };
  
  // Use secrets in function logic
  // Never return them!
  return { status: "ok" };
});
```

### Pattern 3: Overrideable Defaults
```typescript
export default defineHandler(async (payload) => {
  // Use deployment env, override with invocation env
  const model = getEnv("MODEL_NAME") || "default-model";
  const threshold = parseFloat(getEnv("THRESHOLD", "0.7"));
  
  return { model, threshold };
});
```

## Performance

- **Deploy:** ~100-500ms (bundling + writing to disk)
- **Invoke:** ~30-50ms (with VM pooling)
- **Metrics queries:** ~5ms
- **Cold start:** ~50ms (without pooling)

## Tips

1. **Keep functions small** - Easier to test and deploy
2. **Use environment variables** - Avoid hardcoding secrets
3. **Check metrics regularly** - Identify performance issues early
4. **Test in dashboard** - Before deploying to production
5. **Monitor error rates** - High errors indicate problems

## Troubleshooting

### Function fails to deploy
- Check syntax of TypeScript code
- Ensure all imports are valid
- Check bundler logs

### Invocation timeout
- Function might be hanging
- Check if external services are responding
- Increase timeout if needed

### High error rate
- Check function logs
- Review metrics to see when errors started
- Consider rolling back version

## Next Steps

- Add more functions to build pipelines
- Use metrics to optimize performance
- Set up monitoring/alerting
- Create automated testing

---

**API Base URL:** `http://localhost:3000/api`  
**Dashboard:** `http://localhost:3000/`  
**Status:** Active ⚡
