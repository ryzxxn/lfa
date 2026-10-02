# REST API Guide

The Firecracker Lambda API server exposes your functions via HTTP endpoints.

## Start the Server

```bash
cd /Users/eltoncosta/coderepo/firecracker-lambda
npm run -w controller build
npx ts-node controller/src/server-cli.ts
```

Server will start on `http://localhost:3000`

```
🚀 Firecracker Lambda API listening on http://localhost:3000
   GET  http://localhost:3000/           (API docs)
   GET  http://localhost:3000/health     (Health check)
   GET  http://localhost:3000/list       (List functions)
   POST http://localhost:3000/deploy     (Deploy function)
   POST http://localhost:3000/invoke/:name (Invoke function)
```

## Endpoints

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-02T22:50:00.000Z"
}
```

### 2. List Deployed Functions

```bash
curl http://localhost:3000/list
```

Response:
```json
{
  "functions": [
    "hello",
    "compute"
  ],
  "count": 2
}
```

### 3. Deploy a Function

Deploy a function from a TypeScript source file.

**Request:**
```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello",
    "source": "/Users/eltoncosta/coderepo/firecracker-lambda/examples/hello.ts"
  }'
```

**Response:**
```json
{
  "name": "hello",
  "bundlePath": "/var/folders/xx/...T/fc-deployments/hello-1790981239773.js",
  "message": "Deployed hello"
}
```

### 4. Invoke a Function

Execute a deployed function with a JSON payload.

**Request:**
```bash
curl -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
```

**Response:**
```json
{
  "result": {
    "message": "Hello, World!",
    "timestamp": "2026-10-02T22:50:21.530Z"
  },
  "duration": 30
}
```

## Usage Examples

### Example 1: Simple Hello Function

```bash
# 1. List functions
curl http://localhost:3000/list

# 2. Invoke hello with a name
curl -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice"}'
```

### Example 2: Invoke Compute Function

```bash
# Fibonacci(15)
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":15}'
```

Response:
```json
{
  "result": {
    "input": 15,
    "result": 610
  },
  "duration": 28
}
```

### Example 3: Deploy Custom Function

```bash
# Create your function
cat > /tmp/my-function.ts << 'EOF'
import { defineHandler } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { a, b } = payload as { a: number; b: number };
  return {
    sum: a + b,
    product: a * b,
    average: (a + b) / 2,
  };
});
EOF

# Deploy it
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "math",
    "source": "/tmp/my-function.ts"
  }'

# Invoke it
curl -X POST http://localhost:3000/invoke/math \
  -H "Content-Type: application/json" \
  -d '{"a":10,"b":20}'
```

Response:
```json
{
  "result": {
    "sum": 30,
    "product": 200,
    "average": 15
  },
  "duration": 25
}
```

## Error Handling

### Missing Required Fields

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{"name":"foo"}'  # Missing source
```

Response:
```json
{
  "error": "Missing name or source"
}
```

### Non-existent Function

```bash
curl -X POST http://localhost:3000/invoke/nonexistent \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{
  "error": "Function 'nonexistent' not deployed",
  "duration": 0
}
```

### Function Execution Error

```bash
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{}'  # Missing 'n' parameter
```

Response:
```json
{
  "error": "Expected a and b parameters",
  "duration": 5
}
```

## Request/Response Details

### Deploy Request

```json
{
  "name": "function-name",
  "source": "/absolute/path/to/function.ts"
}
```

### Deploy Response (Success: 201)

```json
{
  "name": "function-name",
  "bundlePath": "/path/to/bundled/function.js",
  "message": "Deployed function-name"
}
```

### Deploy Response (Error: 400)

```json
{
  "error": "Error message"
}
```

### Invoke Request

```json
{
  "key1": "value1",
  "key2": "value2",
  "nested": {
    "data": "here"
  }
}
```

### Invoke Response (Success: 200)

```json
{
  "result": {
    "your": "function output"
  },
  "duration": 25
}
```

### Invoke Response (Error: 400)

```json
{
  "error": "Error message",
  "duration": 5
}
```

## Tips & Tricks

### Using jq for Pretty Output

```bash
curl -s http://localhost:3000/list | jq .
```

### Storing Payload in File

```bash
cat > payload.json << 'EOF'
{
  "n": 15
}
EOF

curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d @payload.json
```

### Using Environment Variables

```bash
NAME="Alice"
curl -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\"}"
```

### Chaining with Other Tools

```bash
# Get list of functions and invoke each one
curl -s http://localhost:3000/list | jq '.functions[]' | while read -r func; do
  echo "Invoking $func..."
  curl -s -X POST "http://localhost:3000/invoke/$func" \
    -H "Content-Type: application/json" \
    -d '{}' | jq .
done
```

### Benchmark Performance

```bash
time curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":20}' | jq '.duration'
```

## Integration Examples

### Python Script

```python
import requests
import json

BASE_URL = "http://localhost:3000"

# List functions
response = requests.get(f"{BASE_URL}/list")
print("Deployed functions:", response.json())

# Invoke function
response = requests.post(
    f"{BASE_URL}/invoke/hello",
    json={"name": "Python"},
    headers={"Content-Type": "application/json"}
)
print("Result:", response.json())
```

### JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// Invoke function
async function invoke(name, payload) {
  const response = await fetch(`${BASE_URL}/invoke/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

invoke('hello', { name: 'Node.js' }).then(console.log);
```

### Docker Compose Integration

```yaml
version: '3'
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    command: npx ts-node controller/src/server-cli.ts
```

## Performance Notes

- **Cold start:** 20-40ms (includes bundling)
- **Warm invocation:** 25-35ms
- **Function execution time:** Included in `duration`
- **API overhead:** ~5ms per request

## Troubleshooting

### Port Already in Use

```bash
lsof -i :3000
kill -9 <PID>
```

### CORS Issues

The API doesn't enable CORS by default. To enable it, modify `server.ts`:

```typescript
const response = {
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",  // Add this
  },
  body: "...",
};
```

### Request Body Size

Default limit is 64KB. For larger payloads, increase in `server.ts`:

```typescript
const req = http.createServer((req, res) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 1024 * 1024) { // 1MB
    res.writeHead(413);
    res.end('Payload too large');
    return;
  }
  // ... handle request
});
```

## Security Notes

This is a development API server:
- ❌ No authentication
- ❌ No rate limiting
- ❌ No input validation
- ❌ No CORS protection

For production, add:
- API key authentication
- Rate limiting (use `redis` or similar)
- Input validation
- HTTPS/TLS
- CORS properly configured
- Request/response logging
