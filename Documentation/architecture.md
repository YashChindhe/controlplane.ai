# System Architecture — ControlPlane.ai (Tri-Guard)

---

## 1. App Flow & Architecture

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ENTERPRISE APPLICATION                               │
│                   (Copilot / Q&A / Workflow / Code Assistant)                   │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │  OpenAI-compatible REST / SSE
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CONTROLPLANE.AI PROXY GATEWAY                           │
│                                                                                 │
│  ┌─────────────┐    ┌──────────────────────────────────────────────────────┐    │
│  │  Auth &     │    │                  REQUEST PIPELINE                    │    │
│  │  Tenant     │───▶│  Rate Limiter → Prompt Sanitizer → Model Router      │    │
│  │  Resolver   │    │  → Upstream LLM Call (streaming)                     │    │
│  └─────────────┘    └──────────────────────┬───────────────────────────────┘    │
│                                            │ token stream (SSE chunks)          │
│                                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                     TRI-GUARD EVALUATOR (< 50ms / chunk)                │    │
│  │                                                                         │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │    │
│  │  │ PERFORMANCE GUARD│  │   COST GUARD     │  │  RESPONSIBILITY GUARD│  │    │
│  │  │                  │  │                  │  │                      │  │    │
│  │  │ Distilled SLM    │  │ Token counter    │  │ Regex + Embedding    │  │    │
│  │  │ Hallucination    │  │ Semantic density │  │ PII Detector         │  │    │
│  │  │ Detector         │  │ Model-task fit   │  │ Bias Signal Detector │  │    │
│  │  │ Confidence       │  │ Cost projector   │  │ Regulatory Tagger    │  │    │
│  │  │ Calibrator       │  │                  │  │                      │  │    │
│  │  │ Risk Score 0-100 │  │ Efficiency Score │  │ Responsibility Score │  │    │
│  │  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │    │
│  │           └──────────────────────┴──────────────────────┘              │    │
│  │                                  │ parallel verdict aggregation        │    │
│  │                                  ▼                                     │    │
│  │                        ┌──────────────────┐                            │    │
│  │                        │  ACTION MATRIX   │                            │    │
│  │                        │  Policy Resolver │                            │    │
│  │                        └────────┬─────────┘                            │    │
│  └─────────────────────────────────┼───────────────────────────────────────┘    │
│                                    │                                            │
│       ┌────────────────────────────┼────────────────────────────────────┐       │
│       │          Action Routing    │                                    │       │
│       ▼                           ▼                          ▼          ▼       │
│  Silent Redact             Flag + Log                   Reroute   Block+Escalate│
│                                    │                                            │
│                           ┌────────▼────────┐                                   │
│                           │  AUDIT VAULT    │                                   │
│                           │ (Append-only)   │                                   │
│                           └─────────────────┘                                   │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ Governed output stream
                               ▼
                        ENTERPRISE APPLICATION
```

### Detailed Data Flow — Streaming Interception

1. **Request Ingress**: Enterprise app sends a chat/completion request to `api.controlplane.ai/v1/chat/completions` (identical schema to OpenAI API). TLS terminated at edge.

2. **Auth & Tenant Resolution**: JWT/API key validated against Tenant Registry. Tenant config (policy set, model routing table, alert config) loaded from cache (Redis, TTL: 60s).

3. **Prompt Pre-Processing**: Optional prompt injection scan. Sensitive field extraction from system prompt for RAG grounding context.

4. **Model Routing**: Semantic Query Router scores task complexity. Routes to the most cost-appropriate model that meets the tenant's quality SLA. Upstream LLM request initiated with streaming enabled.

5. **Stream Interception Loop** (core loop, runs per chunk):
   - Upstream SSE chunks buffered into a sliding evaluation window (default: 50 tokens)
   - Window dispatched to Performance Guard, Cost Guard, Responsibility Guard concurrently via async coroutines
   - Each Guard returns a verdict (score + triggered rules) within the 50ms budget
   - Verdict Aggregator merges the three scores against the tenant's policy thresholds
   - Action Matrix resolves the appropriate action
   - If action = "pass" or "flag": chunk is forwarded downstream immediately (non-blocking path)
   - If action = "redact": chunk is modified inline, forwarded
   - If action = "block": stream is terminated, error returned
   - Event (regardless of action) is written async to Audit Vault queue

6. **Response Completion**: Full governed response delivered. Post-response analytics aggregated and committed to time-series store.

7. **Async Processes**: Audit events flushed from queue to Audit Vault. Alert engine evaluates whether escalation thresholds are crossed. Dashboard metrics and Audit Vault dynamically auto-poll new events in real-time.

---

### Architecture Patterns

- **Architecture Style**: Microservices with an async event-driven backbone (Kafka for event streaming between services)
- **Deployment Model**: Kubernetes (K8s) on cloud (AWS EKS primary, GCP GKE secondary). Tenant isolation via namespace + network policy.
- **Data Isolation**: Strict per-tenant data namespace in every store. No cross-tenant data access at the application layer or storage layer.
- **Latency Budget**: Proxy overhead target <50ms (p99) added to base LLM latency. Achieved via async parallel evaluation, in-process SLM inference (no network hop for evaluators).
- **Scalability**: Horizontal pod autoscaling on the Proxy Gateway and Tri-Guard Worker services. Kafka consumer groups scaled independently per Guard.
- **Fault Tolerance**: Tri-Guard evaluation failure → fail-open by default (output passes through, event flagged). Configurable to fail-closed for high-assurance tenants.

---

## 2. Folder & File Structure

```
controlplane.ai/
├── apps/
│   ├── gateway/                        # Proxy Gateway Service (Node.js / FastAPI hybrid)
│   │   ├── src/
│   │   │   ├── server.ts               # HTTP server entry point
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts             # JWT + API key validation
│   │   │   │   ├── tenant.ts           # Tenant config resolution + cache
│   │   │   │   ├── rate-limiter.ts     # Per-tenant rate limiting
│   │   │   │   └── request-log.ts      # Request ingress logging
│   │   │   ├── routes/
│   │   │   │   ├── chat.ts             # /v1/chat/completions handler
│   │   │   │   ├── completions.ts      # /v1/completions handler
│   │   │   │   └── health.ts           # /health, /ready probes
│   │   │   ├── proxy/
│   │   │   │   ├── upstream.ts         # Upstream LLM request builder
│   │   │   │   ├── stream-interceptor.ts # SSE chunk interception loop
│   │   │   │   └── model-router.ts     # Semantic query router
│   │   │   └── action-matrix/
│   │   │       ├── resolver.ts         # Verdict → action resolution
│   │   │       ├── redactor.ts         # Inline PII masking
│   │   │       ├── rerouter.ts         # Mid-stream model switch
│   │   │       └── escalator.ts        # Block + webhook fire
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── tri-guard/                      # Tri-Guard Evaluator Service (Python)
│   │   ├── src/
│   │   │   ├── main.py                 # FastAPI entry point
│   │   │   ├── guards/
│   │   │   │   ├── performance/
│   │   │   │   │   ├── hallucination.py    # Distilled SLM inference
│   │   │   │   │   ├── contradiction.py    # Intra-response consistency check
│   │   │   │   │   ├── confidence.py       # Confidence calibration scorer
│   │   │   │   │   └── scorer.py           # Aggregate Performance Risk Score
│   │   │   │   ├── cost/
│   │   │   │   │   ├── token_counter.py    # Real-time token + cost estimation
│   │   │   │   │   ├── density_scorer.py   # Semantic density evaluation
│   │   │   │   │   ├── task_fit.py         # Model-task complexity matching
│   │   │   │   │   └── scorer.py           # Aggregate Cost Efficiency Score
│   │   │   │   └── responsibility/
│   │   │   │       ├── pii_detector.py     # Regex + embedding PII detection
│   │   │   │       ├── bias_detector.py    # Demographic bias signal scoring
│   │   │   │       ├── regulatory.py       # Regulation tag mapping
│   │   │   │       └── scorer.py           # Aggregate Responsibility Score
│   │   │   ├── pipeline/
│   │   │   │   ├── evaluator.py        # Parallel guard orchestrator (asyncio)
│   │   │   │   ├── verdict.py          # Verdict aggregation model
│   │   │   │   └── chunk_buffer.py     # Sliding token window management
│   │   │   ├── models/
│   │   │   │   ├── slm_loader.py       # Distilled SLM model loading (ONNX)
│   │   │   │   └── embedder.py         # Embedding model for semantic checks
│   │   │   └── policy/
│   │   │       ├── engine.py           # Policy rule evaluation
│   │   │       └── loader.py           # Tenant policy fetch from Policy Service
│   │   ├── model_artifacts/            # ONNX-quantized SLM model files (gitignored)
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── dashboard/                      # Governance Dashboard (Next.js)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/             # Login / SSO callback pages
│   │   │   │   ├── dashboard/          # Main dashboard layout + pages
│   │   │   │   │   ├── live-feed/      # Real-time incident feed
│   │   │   │   │   ├── analytics/      # Cost + risk analytics
│   │   │   │   │   ├── compliance/     # Compliance posture heatmaps
│   │   │   │   │   └── models/         # Model performance comparison
│   │   │   │   ├── policy-studio/      # Policy authoring UI
│   │   │   │   └── audit-vault/        # Audit log browser + export
│   │   │   ├── components/
│   │   │   │   ├── ui/                 # Design system components
│   │   │   │   ├── charts/             # Risk timelines, heatmaps
│   │   │   │   ├── incident-card/      # Incident event card component
│   │   │   │   └── policy-builder/     # Visual rule builder components
│   │   │   ├── lib/
│   │   │   │   ├── api.ts              # API client (REST + WebSocket)
│   │   │   │   ├── auth.ts             # Auth helpers (NextAuth)
│   │   │   │   └── ws.ts               # WebSocket live feed client
│   │   │   └── types/                  # Shared TypeScript types
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   ├── policy-service/                 # Policy CRUD + Versioning Service (Python/FastAPI)
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── routes/
│   │   │   │   ├── rules.py            # Rule CRUD endpoints
│   │   │   │   ├── templates.py        # Pre-built rule template endpoints
│   │   │   │   └── deploy.py           # Staging → production promotion
│   │   │   ├── models/
│   │   │   │   ├── rule.py             # Rule data model + versioning
│   │   │   │   └── policy_set.py       # Tenant policy set aggregate
│   │   │   └── db/
│   │   │       └── migrations/         # Alembic migrations
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── audit-service/                  # Audit Vault Write + Query Service (Python/FastAPI)
│       ├── src/
│       │   ├── main.py
│       │   ├── writer.py               # Kafka consumer → WORM store writer
│       │   ├── query.py                # Search + filter audit events
│       │   └── exporter.py             # CSV / JSON / PDF export
│       ├── Dockerfile
│       └── requirements.txt
│
├── packages/
│   ├── sdk-python/                     # Python SDK (pip installable)
│   │   ├── controlplane/
│   │   │   ├── client.py               # Main SDK client
│   │   │   ├── streaming.py            # Streaming response wrapper
│   │   │   └── types.py                # Type definitions
│   │   └── setup.py
│   │
│   └── sdk-node/                       # Node.js SDK (npm installable)
│       ├── src/
│       │   ├── client.ts
│       │   ├── streaming.ts
│       │   └── types.ts
│       └── package.json
│
├── infra/
│   ├── k8s/                            # Kubernetes manifests
│   │   ├── gateway/
│   │   ├── tri-guard/
│   │   ├── dashboard/
│   │   ├── policy-service/
│   │   ├── audit-service/
│   │   └── shared/                     # Kafka, Redis, Postgres operators
│   ├── terraform/                      # AWS EKS cluster, RDS, MSK, ElastiCache
│   └── helm/                           # Helm chart for self-hosted deployment
│
├── Documentation/
│   ├── prd.md
│   ├── architecture.md
│   ├── design.md
│   ├── memory.md
│   ├── phases.md
│   └── rules.md
│
├── References/
│   ├── problemstatement.png
│   └── proposedsolution.png
│
├── docker-compose.yml                  # Local development compose
└── README.md
```

---

## 3. Tech Stack

### Backend — Core Services

| Layer | Technology | Rationale |
|---|---|---|
| **Gateway / Proxy Service** | Node.js (TypeScript) + Fastify | Non-blocking I/O critical for SSE streaming proxy. Fastify's plugin architecture and low overhead ideal for high-throughput proxy. |
| **Tri-Guard Evaluator Service** | Python 3.11 + FastAPI + asyncio | Python-native ML inference ecosystem. asyncio enables parallel guard execution without threads. FastAPI for lightweight internal HTTP + WebSocket API. |
| **Policy Service** | Python 3.11 + FastAPI + SQLAlchemy | CRUD service with relational data model (versioned rules). Standard patterns, simple to reason about. |
| **Audit Service** | Python 3.11 + FastAPI | High-throughput write path via Kafka consumer. Query path via Elasticsearch. |

### AI / ML Inference

| Component | Technology | Rationale |
|---|---|---|
| **Distilled SLM Evaluators** | ONNX Runtime + quantized DistilBERT/TinyLlama variants | ONNX enables cross-platform, CPU-optimized inference. Quantized INT8 models fit in <500MB RAM, achieve <20ms inference. No GPU required for evaluation layer. |
| **Embedding Model** | sentence-transformers (all-MiniLM-L6-v2) via ONNX | Fast, compact embeddings for semantic density scoring and PII context matching. |
| **PII Regex Engine** | Microsoft Presidio + custom extensions | Battle-tested, multilingual PII detection. Extensible with custom recognizers for tenant-specific entity types. |
| **Semantic Query Router** | Custom lightweight classifier on top of sentence-transformers | Classifies task type (factual Q&A, creative, code, summarization, etc.) to route to appropriate model tier. |

### Data Stores

| Store | Technology | Purpose |
|---|---|---|
| **Primary Relational DB** | PostgreSQL 15 (AWS RDS) | Tenant registry, policy rules, user accounts, rule versions, alert configs |
| **Audit Vault** | Amazon S3 (WORM-mode / Object Lock) + Elasticsearch | S3 for durable, append-only immutable storage (which can be dynamically wiped in local testing environments). Elasticsearch for full-text search and time-series queries across audit events. |
| **Cache** | Redis 7 (ElastiCache) | Tenant config cache (TTL: 60s), rate limit counters, session tokens |
| **Event Bus** | Apache Kafka (AWS MSK) | Async event streaming between Proxy Gateway, Audit Service, Alert Engine. Decouples evaluation path from audit write path. |
| **Time-Series Metrics** | InfluxDB (or AWS Timestream) | Risk score timelines, cost analytics, per-model performance metrics for Dashboard |

### Frontend

| Layer | Technology | Rationale |
|---|---|---|
| **Dashboard + Policy Studio + Audit Vault UI** | Next.js 14 (App Router) + TypeScript | Server components for fast initial render. App Router for layout nesting. Streamlined passwordless UI provides instant access to the dynamic governance observability features. |
| **Charting** | Recharts + D3.js | Recharts for standard time-series charts. D3 for custom compliance heatmaps and risk score visualizations. |
| **Real-Time Live Feed** | WebSocket (native browser API) via Next.js API route proxy | Low-latency push from Kafka consumer to dashboard. |
| **Styling** | Vanilla CSS + CSS custom properties (design tokens) | Maximum control over design system. No Tailwind lock-in. |
| **Auth** | NextAuth.js v5 (supports OIDC, SAML via saml-jackson) | Handles SSO integration cleanly within the Next.js ecosystem. |

### Infrastructure & DevOps

| Layer | Technology |
|---|---|
| **Container Orchestration** | Kubernetes (AWS EKS) |
| **Container Registry** | AWS ECR |
| **Infrastructure as Code** | Terraform (AWS provider) |
| **Service Mesh** | Istio (mTLS between services, traffic management) |
| **API Gateway / Edge** | AWS API Gateway + CloudFront (for Dashboard CDN) |
| **CI/CD** | GitHub Actions → Docker build → ECR push → kubectl rollout |
| **Observability** | Prometheus + Grafana (metrics), Jaeger (distributed tracing), Loki (log aggregation) |
| **Secrets Management** | AWS Secrets Manager + External Secrets Operator in K8s |
| **Self-Hosted Option** | Helm chart targeting any K8s cluster (GKE, AKS, on-prem) |

### Security Architecture

| Concern | Approach |
|---|---|
| **Data in Transit** | TLS 1.3 everywhere. mTLS between internal services via Istio. |
| **Data at Rest** | AES-256 encryption on all stores. S3 audit data encrypted with customer-managed KMS keys. |
| **Tenant Isolation** | Separate Kafka topics per tenant. Separate Elasticsearch indices per tenant. PostgreSQL row-level security enforced. |
| **PII in Logs** | All request/response content hashed before audit log. Raw content stored separately in encrypted S3 with strict access controls. |
| **API Key Security** | Keys stored as bcrypt hashes. Displayed once on creation. Rotatable without downtime. |