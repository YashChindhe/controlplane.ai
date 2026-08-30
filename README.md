# ControlPlane.ai (Tri-Guard)

**ControlPlane.ai** is an enterprise-grade, model-agnostic **AI Output Governance Platform** built around a core engine called **Tri-Guard** — a real-time, inline oversight layer that intercepts every token stream from any LLM and evaluates it across risk dimensions simultaneously before the output reaches the consuming application or end user.

It is a **live trust layer** — a transparent, non-blocking middleware proxy that sits between any LLM provider (OpenAI, Anthropic, Gemini, Mistral, Azure OpenAI, Bedrock, self-hosted models) and the enterprise applications that consume their outputs.

---

## Core Engine: Tri-Guard Evaluator

The Tri-Guard Evaluator is a streaming interception pipeline with three parallel micro-check engines running concurrently on every partial chunk of generated text:

1. **Performance Guard** — Detects hallucinations, factual inconsistencies, uncalibrated confidence expressions, and logical contradictions in real time. Returns a Performance Risk Score (0–100) per chunk.
2. **Cost Guard** — Detects token bloat, verbose over-generation, and wrong-model-for-task routing. Capable of mid-stream rerouting of output to a cheaper or specialized model tier.
3. **Responsibility Guard** — Detects PII leakage (names, emails, etc.), demographic bias signals, and regulatory compliance drift. Uses a regex + embedding hybrid policy engine.

All three evaluators run **in parallel on partial streaming chunks** — meaning verdicts are returned before generation finishes (in under 50 milliseconds).

## The Action Matrix

When one or more risk signals exceed configurable thresholds, the Action Matrix applies one of four automatic resolutions:

| Action | Trigger Condition | Behavior |
|---|---|---|
| **Silent Redact / Mask** | Low severity + reversible | Auto-masks PII, trims bloat, inline replacement — zero user-facing disruption |
| **Reroute** | Wrong-sized model for task | Mid-stream redirect to cheaper or specialized model tier, transparent to caller |
| **Flag + Shadow Log** | Non-blocking risk, compliance-relevant | Output delivered; event logged to immutable audit trail for async review |
| **Block + Escalate** | High-stakes, irreversible risk | Stream halted; human-in-the-loop escalation triggered; caller receives structured error |

## Platform Surface Areas

Beyond the core engine, ControlPlane.ai exposes:
- **Governance Dashboard**: Real-time observability UI for live token stream monitoring, risk score timelines, and model performance comparisons.
- **Policy Studio**: No-code / low-code policy authoring UI to define and deploy custom rules for each Guard.
- **Audit Vault**: Immutable, tamper-evident log store for every intercepted output event, verdict, and action taken.
- **SDK / Proxy API**: Drop-in OpenAI-compatible proxy endpoint.
- **Alert & Escalation Engine**: Configurable webhooks for Slack/Teams/PagerDuty integrations.

## Recent Updates

- **Streamlined UI**: Removed the mock 'Admin/Viewer' toggle and initial 'Sign In' screens to provide immediate, frictionless access to the platform's core governance features.
- **Dynamic Real-Time Observability**: The Analytics and Audit Vault dashboards now feature dynamic auto-polling, seamlessly updating charts and tables in real-time as the Gateway intercepts new LLM traffic.
- **Persistent WORM Storage Management**: The Audit Service's history clearing capabilities have been upgraded to dynamically wipe immutable WORM archives directly from the disk for local testing environments.
- **Provider Configurations**: Added dynamic, database-backed UI controls to seamlessly add and securely delete AI Provider credentials (like OpenAI or Ollama endpoints).
- **Extended Tri-Guard Scope**: Upgraded the streaming and non-streaming interception pipelines to evaluate the entire context window (User Prompt + Model Response), detecting PII even if the LLM refuses to generate a violation.
- **Network Hardening**: Enforced explicit IPv4 `127.0.0.1` routing across all inter-service communications (Node.js/Fastify → Python/FastAPI) to eliminate IPv6 ECONNREFUSED issues on Windows.
- **True Passthrough Mode**: Hardened the test playground's 'mock' bypass logic, allowing users to successfully proxy real requests to local models (e.g., `qwen2.5` via Ollama) on port 11434.

## Getting Started

The platform runs as a set of interconnected microservices orchestrated via Docker Compose.

### Prerequisites
- Docker and Docker Compose
- Python 3.11+
- Node.js 20+

### Running Locally

To start the development environment, simply execute the provided PowerShell script from the project root:

```powershell
./run-dev.ps1
```

This will build and start the following services:
- **Postgres Database**: For relational data and audit logs
- **Redis**: For caching and real-time streaming operations
- **Audit Service** & **Policy Service**: Python-based microservices
- **Gateway**: Node.js API Gateway (available at `http://localhost:3000`)
- **Dashboard**: React/Next.js Governance UI (available at `http://localhost:3001`)
- **Tri-Guard Engine**: Python evaluation service (available at `http://localhost:8000`)

Wait a few seconds for all databases and services to initialize. The script will output the URLs for the Gateway, Dashboard, and Tri-Guard once they are ready.

## Architecture

ControlPlane.ai is built with a modern, scalable architecture:
- **Tri-Guard (Python 3.11)**: High-performance streaming evaluation engine.
- **Microservices (Python/Node)**: specialized services for auditing (Audit Vault) and policies (Policy Studio).
- **Dashboard (Node 20/React)**: Real-time UI for governance observability.
- **Infrastructure**: Postgres for durable storage and Redis for low-latency state management and pub/sub.

---
*For detailed product requirements and feature breakdown, please refer to the `/Documentation/prd.md` file.*
