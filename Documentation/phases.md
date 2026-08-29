# Breakdown of Project — ControlPlane.ai (Tri-Guard)

---

## Overview

The project is broken into two phases. Phase 1 delivers a working, production-deployable MVP: the Tri-Guard proxy engine + Governance Dashboard + basic Policy Studio. Phase 2 adds depth: agentic guards, advanced compliance features, self-hosted deployment, and the full enterprise feature set.

Each milestone is a shippable unit — at the end of every milestone, the system can be demoed or used end-to-end, even if not all features are complete.

---

## Phase 1 — MVP: Real-Time Tri-Guard Engine + Core Platform

**Target Duration**: 12 weeks (3 months)
**Outcome**: A production-deployable enterprise SaaS that any company can integrate with a base URL change. Covers the full Tri-Guard interception loop, governance dashboard, basic policy studio, audit vault, and SDK.

---

### Milestone 1.1 — Monorepo Foundation & Transparent Proxy (Weeks 1–2) [COMPLETED]

**Goal**: Stand up the project skeleton and deliver a working transparent proxy that can sit in front of any LLM with zero modification to behavior.

**Deliverables**:
- [x] Monorepo initialized with the folder structure defined in `architecture.md`
- [x] `apps/gateway/` — Node.js + Fastify + TypeScript server
  - [x] OpenAI-compatible `/v1/chat/completions` endpoint (non-streaming + streaming)
  - [x] Transparent SSE pass-through proxy to OpenAI, Anthropic, Azure OpenAI
  - [x] Tenant API key auth middleware (stub: accept any valid-format key)
  - [x] Rate limiter middleware (per-tenant, Redis-backed)
  - [x] Request/response logging to console (structured JSON)
- [x] `docker-compose.yml` — Gateway + Redis + Postgres running locally
- [x] Health check endpoints `/health`, `/ready`
- [x] Basic GitHub Actions CI: lint + typecheck on push

**Success Criteria**: A developer can point their OpenAI SDK at `http://localhost:3000/v1` and get identical responses to hitting OpenAI directly. Streaming works. Latency overhead < 5ms (proxy-only, no evaluation yet).

---

### Milestone 1.2 — Tri-Guard Service Foundation & Stream Interception (Weeks 3–4) [COMPLETED]

**Goal**: Wire up the evaluation pipeline. Guards are stubbed (return mock scores), but the interception loop, chunk buffering, and Action Matrix resolver are real.

**Deliverables**:
- [x] `apps/tri-guard/` — Python + FastAPI service
  - [x] Stub Performance Guard: returns mock score 0–100 based on keyword heuristics
  - [x] Stub Cost Guard: returns real token count + mock density score
  - [x] Stub Responsibility Guard: returns real regex PII detection (basic config)
  - [x] Internal gRPC/HTTP endpoint: `/evaluate` (accepts chunk, returns verdict in <10ms)
- [x] `apps/gateway/` — Stream Interception Loop
  - [x] `stream-interceptor.ts`: sliding 50-token evaluation window
  - [x] Async call to Tri-Guard service per window (non-blocking — stream continues)
  - [x] Verdict Aggregator: merges three scores per evaluation cycle
  - [x] Action Matrix resolver: resolves action from verdict + policy thresholds
  - [x] Action: "pass" (forward chunk), "flag" (forward + log event), "block" (terminate stream)
  - [x] Action: "redact" (regex mask + forward modified chunk) — Responsibility Guard only at this stage
- [x] Kafka setup in docker-compose: audit events written to Kafka topic
- [x] Structured audit event schema defined (JSON schema)

**Success Criteria**: Stream interception is active. PII in a response is detected and redacted inline. Blocking works (stream terminates, caller receives GovernanceViolation error). Evaluation latency < 50ms p99 (stub guards only).

---

### Milestone 1.3 — Real ML Guard Engines (Weeks 5–7) [COMPLETED]

**Goal**: Replace stub guards with real inference. This is the hardest milestone technically — getting distilled SLM inference fast enough to meet the 50ms budget.

**Deliverables**:
- [x] **Performance Guard (real)**:
  - [x] Integrate ONNX Runtime with quantized DistilBERT fine-tuned on HaluEval (hallucination detection)
  - [x] Implement contradiction detector (cosine similarity between sentence pairs within window)
  - [x] Implement confidence calibration scorer (pattern-based detection of hedging vs. overconfident language)
  - [x] Benchmark: must return score in < 20ms (single-core CPU)
- [x] **Cost Guard (real)**:
  - [x] Real token count against tiktoken / Anthropic tokenizer per model
  - [x] Real projected cost calculation against pricing table (config file, updated monthly)
  - [x] Semantic density scorer: information entropy vs. token count ratio (sentence-transformers)
  - [x] Model-task fit classifier: lightweight 3-class classifier (simple/medium/complex task) vs. model tier capability
- [x] **Responsibility Guard (real)**:
  - [x] Microsoft Presidio integration with 40+ entity recognizers
  - [x] Custom recognizers for: IBAN, health IDs, internal project codes (tenant-configurable)
  - [x] Demographic bias detector: embedding-based comparison of parallel phrasings on protected attributes
  - [x] Regulatory tagger: rule-based mapping of violation type → regulation article
- [x] ONNX model artifact pipeline: download from S3/HF on container start, cache locally
- [x] Performance benchmarking script: measure p50/p99 latency across all three guards

**Success Criteria**: Real hallucination detection operational. Real PII detection (Presidio) at <30ms. All three guards together within 50ms p99 on a 2-vCPU container. 

---

### Milestone 1.4 — Governance Dashboard v1 (Weeks 7–9) [COMPLETED]

**Goal**: Build the core real-time observability UI. Engineers and executives can see what's happening across all AI outputs in real time.

**Deliverables**:
- `apps/dashboard/` — Next.js 14 App Router, TypeScript, Vanilla CSS design system
  - Design system: all CSS custom properties from `design.md` implemented in `globals.css`
  - Inter + JetBrains Mono loaded via Google Fonts
  - Auth: NextAuth.js v5, simple email/password first (SSO in Phase 2)
  - Layout: sidebar nav + main content area (dashboard shell)
- **Live Feed page** (`/dashboard/live-feed`):
  - WebSocket connection to backend: receive audit events in real time
  - Incident card component: shows severity badge, guard type, action taken, timestamp, truncated output
  - Auto-refresh last 100 events, infinite scroll for history
  - Filter bar: by guard, by action, by severity, by time range
- **Analytics page** (`/dashboard/analytics`):
  - Risk score timelines: Recharts line chart (Performance, Cost, Responsibility scores over time)
  - Time range picker: 1h, 24h, 7d, 30d
  - Cost metrics: daily spend by model, application
- **Compliance page** (`/dashboard/compliance`):
  - Heatmap: regulation × day, cell color = risk incident count (D3.js)
  - Violation breakdown by regulation
- Backend: WebSocket gateway in `apps/gateway/` that pushes Kafka events to connected dashboard clients

**Success Criteria**: Dashboard shows real-time events within 500ms of interception. Risk timelines render correctly. Compliance heatmap loads in under 2 seconds.

---

### Milestone 1.5 — Policy Studio & Audit Vault (Weeks 10–11) [COMPLETED]

**Goal**: Give compliance officers and AI leads self-service control over governance rules without writing code. Give auditors a searchable, exportable log.

**Deliverables**:
- [x] `apps/policy-service/` — FastAPI + PostgreSQL
  - [x] Rule CRUD API: create, read, update, delete, list rules
  - [x] Rule versioning: every save creates a new immutable version
  - [x] Rule deployment API: promote rule version from staging → production
  - [x] Pre-built template library: GDPR PII Pack (5 rules), HIPAA Data Pack (4 rules), EU AI Act Annex III Pack (3 rules)
- [x] **Policy Studio UI** (`/policy-studio`):
  - [x] Visual rule builder: condition editor (guard + field + operator + threshold) + action selector
  - [x] Rule list view with version history
  - [x] Rule testing sandbox: paste sample text, run dry-run against current policy, see triggered rules
  - [x] Template library: browse and import pre-built packs
- [x] `apps/audit-service/` — FastAPI + Elasticsearch
  - [x] Kafka consumer → Elasticsearch index writer (per-tenant index)
  - [x] S3 WORM archive writer (sync of audit events to S3 Object Lock)
  - [x] Query API: full-text search, filter by date, guard, action, severity
  - [x] Export API: download audit events as CSV, JSON, or PDF report
- [x] **Audit Vault UI** (`/audit-vault`):
  - [x] Searchable audit log table with filters
  - [x] Event detail modal: full request hash, response hash, all three risk scores, action taken, rules triggered
  - [x] Export button: trigger CSV/JSON/PDF download

**Success Criteria**: A compliance officer can create a new PII rule in Policy Studio with no code, deploy it to staging, test it, and promote it to production in under 10 minutes. Audit Vault shows all events from the last 30 days, searchable.

---

### Milestone 1.6 — SDK, Integrations & Hardening (Week 12)

**Goal**: Package the integration surface for developer adoption. Harden the system for production use.

**Deliverables**:
- `packages/sdk-python/`: Python SDK — `controlplane.AsyncClient`, drop-in for `openai.AsyncOpenAI`. Handles streaming transparently.
- `packages/sdk-node/`: Node.js SDK — `ControlPlane` class, drop-in for `openai.OpenAI`.
- Webhook integrations: Slack (block escalation → Slack message), PagerDuty (critical incident → PD alert)
- Kubernetes manifests for all services (production-ready, resource limits, HPA configured)
- End-to-end integration tests: simulate streaming LLM output → detect PII → redact → verify in audit log
- Load test: 100 concurrent streaming requests, verify p99 < 50ms evaluation latency holds
- Security review: check tenant isolation, API key handling, PII in logs

**Phase 1 complete**: System is production-deployable. First enterprise pilot customers can be onboarded.

---

## Phase 2 — Enterprise Depth & Scale

**Target Duration**: 12 weeks (Months 4–6)
**Outcome**: Full enterprise feature set — SSO/RBAC, agentic workflow guard, RAG quality guard, self-hosted deployment, model benchmarking, advanced rerouting.

---

### Milestone 2.1 — SSO, RBAC & Multi-Tenant Hardening (Weeks 1–3)

**Goal**: Enterprise-grade identity and access management. Required for regulated industry sales.

**Deliverables**:
- SAML 2.0 SSO via saml-jackson (plug into NextAuth.js)
- OIDC SSO for Google Workspace, Azure AD, Okta
- Role-based access control: Admin, Policy Author, Auditor, Viewer
- Per-application API key scoping with granular permission flags
- Tenant provisioning flow: self-serve signup → workspace setup wizard
- Audit log for identity events: login, role change, key rotation

---

### Milestone 2.2 — Agentic Workflow Guard (Weeks 3–6)

**Goal**: Extend Tri-Guard from single-response evaluation to multi-step agent chain monitoring.

**Deliverables**:
- Agent session tracking: correlate tool calls and model outputs across a multi-step agent run
- Loop detector: identify when an agent is re-issuing the same or semantically similar tool call
- Cost escalation detector: flag when projected total session cost exceeds configured threshold
- Irreversible action pre-check: before execution of write-type tool calls (email send, DB write, API mutation), pause for human confirmation if risk score is high
- Dashboard: agent session timeline view — visual trace of multi-step runs with risk scores per step

---

### Milestone 2.3 — RAG Quality Guard & Model Benchmarking Suite (Weeks 6–9)

**Goal**: Extend governance to the retrieval layer and give teams ongoing model quality tracking.

**Deliverables**:
- **RAG Quality Guard**:
  - Retrieval relevance scorer: cosine similarity between query and retrieved chunks
  - Grounding fidelity scorer: detect when model output contradicts or ignores retrieved context
  - Integrate as optional fourth guard in the Tri-Guard pipeline
- **Model Benchmarking Suite**:
  - Run standardized evals (MMLU, TruthfulQA, HellaSwag) against any configured model endpoint
  - Scheduled regression runs: daily/weekly eval against model versions
  - Dashboard: model quality over time — detect silent model updates from providers
  - Cost-quality frontier chart: visualize model options by cost vs. quality score

---

### Milestone 2.4 — Self-Hosted Deployment & Advanced Rerouting (Weeks 9–12)

**Goal**: Enable deployment in customer VPCs (data-never-leaves-your-cloud) and complete the smart model routing system.

**Deliverables**:
- Helm chart: single `helm install controlplane .` deploys all services to any K8s cluster
- Air-gap mode: all ML model artifacts bundled, no external network calls required post-install
- Terraform module: one-click AWS VPC + EKS deployment for self-hosted customers
- **Advanced Model Router**:
  - Dynamic routing table: configure model tiers with quality thresholds, cost limits, latency SLAs
  - A/B testing mode: split traffic between two models, compare risk scores, auto-graduate winning model
  - Fallback chains: if primary model fails or times out, automatically reroute to fallback
- Documentation site: full API reference, SDK guides, integration tutorials, compliance white papers