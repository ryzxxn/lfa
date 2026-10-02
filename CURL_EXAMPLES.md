# Quick Curl Commands

Start the API server first:

```bash
cd /Users/eltoncosta/coderepo/firecracker-lambda
npx ts-node controller/src/server-cli.ts
```

Then use these commands in another terminal:

## Health Check

```bash
curl http://localhost:3000/health | jq .
```

## List Deployed Functions

```bash
curl http://localhost:3000/list | jq .
```

## Invoke Hello Function

```bash
curl -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}' | jq .
```

Expected output:
```json
{
  "result": {
    "message": "Hello, World!",
    "timestamp": "2026-10-02T22:50:21.530Z"
  },
  "duration": 30
}
```

## Invoke Compute Function (Fibonacci)

```bash
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":10}' | jq .
```

Expected output:
```json
{
  "result": {
    "input": 10,
    "result": 55
  },
  "duration": 28
}
```

Try different values:
```bash
# Fibonacci(15) = 610
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":15}' | jq .

# Fibonacci(20) = 6765
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":20}' | jq .
```

## Deploy New Function

```bash
# First, create a function file
cat > /tmp/add.ts << 'EOF'
import { defineHandler } from "@firecracker-lambda/framework";

export default defineHandler(async (payload) => {
  const { a, b } = payload as { a: number; b: number };
  return {
    a,
    b,
    sum: a + b,
  };
});
EOF

# Deploy it
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "add",
    "source": "/tmp/add.ts"
  }' | jq .

# Invoke it
curl -X POST http://localhost:3000/invoke/add \
  -H "Content-Type: application/json" \
  -d '{"a":5,"b":3}' | jq .
```

## One-Liners

```bash
# Invoke and extract just the result
curl -s -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"CLI"}' | jq '.result'

# Invoke and extract duration
curl -s -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":15}' | jq '.duration'

# Invoke multiple times in a loop
for i in {1..5}; do
  echo "Run $i:"
  curl -s -X POST http://localhost:3000/invoke/compute \
    -H "Content-Type: application/json" \
    -d "{\"n\":$((i+10))}" | jq '.result'
done
```

## Using Payload Files

```bash
# Create payload file
cat > payload.json << 'EOF'
{"n": 12}
EOF

# Use it
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d @payload.json | jq .
```

## Errors

```bash
# Try to invoke non-existent function
curl -X POST http://localhost:3000/invoke/nonexistent \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Output: {"error":"Function 'nonexistent' not deployed","duration":0}

# Invoke with missing required fields
curl -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Output: {"error":"Expected a and b parameters","duration":5}
```

## Complete Test Sequence

```bash
#!/bin/bash

API="http://localhost:3000"

echo "1. Health check:"
curl -s "$API/health" | jq .

echo -e "\n2. List functions:"
curl -s "$API/list" | jq .

echo -e "\n3. Invoke hello:"
curl -s -X POST "$API/invoke/hello" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}' | jq .

echo -e "\n4. Invoke compute:"
curl -s -X POST "$API/invoke/compute" \
  -H "Content-Type: application/json" \
  -d '{"n":10}' | jq .

echo -e "\n✅ All tests passed!"
```

## Tips

**Pretty print JSON:**
```bash
curl http://localhost:3000/list | jq '.'
```

**Extract specific field:**
```bash
curl -s -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Field"}' | jq '.result.message'
```

**Show response headers:**
```bash
curl -i -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Headers"}'
```

**Verbose output:**
```bash
curl -v -X POST http://localhost:3000/invoke/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"Verbose"}'
```

**Time the request:**
```bash
curl -w "Time: %{time_total}s\n" \
  -X POST http://localhost:3000/invoke/compute \
  -H "Content-Type: application/json" \
  -d '{"n":15}' | jq .
```

See [API.md](API.md) for full documentation.
