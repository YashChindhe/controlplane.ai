# ControlPlane Node.js SDK

TypeScript/JavaScript client wrapping `openai.OpenAI` that automatically targets the ControlPlane Tri-Guard Gateway.

## Installation

```bash
npm install @controlplane/sdk
```

## Usage

```typescript
import { ControlPlane } from '@controlplane/sdk';

const client = new ControlPlane({
  apiKey: 'cp_test_tenant_mytenant',
  baseURL: 'http://localhost:3000/v1' // Default: process.env.CONTROLPLANE_GATEWAY_URL or http://localhost:3000/v1
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: false,
});

console.log(response.choices[0].message.content);
```
