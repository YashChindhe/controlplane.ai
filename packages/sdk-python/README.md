# ControlPlane Python SDK

Drop-in replacement client wrapper for OpenAI SDK that automatically channels LLM traffic through the ControlPlane Tri-Guard Gateway.

## Installation

```bash
pip install -e .
```

## Usage

```python
import os
from controlplane import Client, AsyncClient

# Environment variable check
# Make sure to set:
# os.environ["CONTROLPLANE_API_KEY"] = "cp_test_tenant_your_tenant_id"
# os.environ["CONTROLPLANE_GATEWAY_URL"] = "http://localhost:3000/v1"

client = Client(
    api_key="cp_test_tenant_mytenant",
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=False
)
print(response.choices[0].message.content)
```
