# AI Memory — ControlPlane.ai (Tri-Guard)

> This file is the persistent context document for the AI coding assistant (Antigravity / Claude / Cursor / Copilot) working on this project.
> It is updated at the end of every working session. The AI must read this file at the start of every session before taking any action.
> It is the single source of truth for "where we are."

---

## Project Identity

- **Product Name**: ControlPlane.ai
- **Core Engine**: Tri-Guard (real-time AI output governance)
- **Repository Root**: `c:/Users/Acer/OneDrive/Desktop/projects/controlplane.ai`
- **Documentation Root**: `./Documentation/`
- **Reference Images**: `./References/` (problemstatement.png, proposedsolution.png)

---

## What Has Been Completed

### Documentation Phase (Session 1 — 2026-08-29)

All six documentation files have been authored with full depth. The documentation phase is **complete**.

### Phase 1, Milestone 1.1 (Session 2 — 2026-08-29)
Initialized monorepo scaffolding, base TypeScript configurations, docker-compose configuration, and GitHub Actions CI workflow. Implemented `@controlplane/gateway` (Fastify + TypeScript) with:
- Auth and tenant resolution middleware stubs
- Dynamic rate-limiting middleware with Redis connection error tolerance and in-memory fallback
- Structured Pino logging with SHA-256 content hashing to ensure tenant data privacy
- Transparent OpenAI-compatible `/v1/chat/completions` pass-through proxy with full SSE streaming and non-streaming support
- Integrated health check endpoints and unit tests verifying health routes.

| File | Status | Summary |
|---|---|---|
| `Documentation/prd.md` | ✅ Complete | Full PRD: what to build (Tri-Guard proxy + governance platform), 5 targeted user personas, 15 features across Phase 1 (10 features) and Phase 2 (5 features) |
| `Documentation/architecture.md` | ✅ Complete | Full system architecture: end-to-end data flow diagram, streaming interception loop mechanics, complete folder/file structure for all 5 services + 2 SDKs + infra, full tech stack table covering backend, ML inference, data stores, frontend, and security |
| `Documentation/design.md` | ✅ Complete | Full design language: dark-first color system with all CSS tokens, risk severity semantic color system, gradient system, font selection (Inter + JetBrains Mono), complete 13-step type scale with CSS custom properties, component-level typography application table |
| `Documentation/phases.md` | ✅ Complete | Two-phase implementation plan with 6 milestones in Phase 1 and 4 milestones in Phase 2, each broken into weekly sprint work items |
| `Documentation/rules.md` | ✅ Complete | Engineering rules: what to use (approved libraries, patterns), what to avoid (anti-patterns, prohibited choices), error handling standards, and AI assistant behavioral boundaries |
| `Documentation/memory.md` | ✅ Complete | This file — AI context tracking |

### Key Architectural Decisions Made (Locked)
- **Proxy Gateway**: Node.js + Fastify (NOT Python — SSE streaming performance)
- **Tri-Guard Service**: Python + FastAPI + asyncio (ML inference ecosystem)
- **SLM Inference**: ONNX Runtime, quantized INT8 models, CPU-only (no GPU dependency for evaluation layer)
- **PII Detection**: Microsoft Presidio (not custom-built from scratch)
- **Audit Store**: S3 WORM + Elasticsearch (not a database — regulatory immutability requirement)
- **Event Bus**: Apache Kafka (Pub/Sub considered, rejected — need replay, consumer groups, ordering guarantees)
- **Frontend**: Next.js 14 App Router (not Vite/CRA — SSR needed for dashboard initial render performance)
- **Styling**: Vanilla CSS with custom properties (no Tailwind — design system requires full token control)
- **Fonts**: Inter (UI) + JetBrains Mono (data) — Google Fonts, no licensing cost
- **Auth**: NextAuth.js v5 with saml-jackson for SSO — handles both OIDC and SAML 2.0

---

### Phase 1, Milestone 1.2 (Session 3 — 2026-08-29)
Implemented the Tri-Guard evaluation service core and wired it to the proxy gateway's streaming interception loop:
- Created `apps/tri-guard/` FastAPI Python service with stubs for Performance, Cost, and Responsibility guards.
- Implemented `stream-interceptor.ts` in `apps/gateway` with a sliding 50-token window, asynchronously calling the evaluation service.
- Implemented the Verdict Aggregator and Action Matrix resolver in the gateway.
- Setup Redpanda/Kafka in `docker-compose.yml` and structured audit logs sent to Kafka.
- Verified stream blocking, inline redaction, and logging of violations.

### Phase 1, Milestone 1.3 (Session 4 — 2026-08-29)
Replaced stub guards with real machine learning models and heuristics:
- Integrated ONNX Runtime with quantized DistilBERT to classify hallucination risk in the Performance Guard.
- Implemented sentence-embeddings based contradiction detector and pattern-based confidence calibration.
- Integrated `tiktoken` for accurate OpenAI token counting and mapped model pricing dynamically using `pricing.json` configuration database in Cost Guard.
- Built a semantic density scorer (information entropy) and a model-task fit classifier for Cost Guard.
- Integrated Microsoft Presidio Analyzer and custom pattern recognizers (IBAN, HEALTH_ID, PROJECT_CODE) in Responsibility Guard.
- Added demographic bias detector and regulatory tagger mapping violations to compliance frameworks (GDPR, HIPAA, EU AI Act).
- Created a robust startup pipeline to download required ONNX models directly from HuggingFace Hub.
- Wrote and executed automated unit tests and a performance benchmarking script (`benchmark.py`), achieving average latency under 50ms.

### Phase 1, Milestone 1.4 (Session 5 — 2026-08-29)
Implemented the core real-time observability UI and WebSocket connection:
- Set up `@controlplane/dashboard` Next.js 14 application using App Router.
- Implemented the styling design system in `globals.css` with CSS Custom Properties from `design.md`.
- Integrated NextAuth.js v5 for credential-based authentication.
- Built the Live Feed page (`/dashboard/live-feed`) with WebSocket connection to display real-time audit events.
- Built the Analytics page (`/dashboard/analytics`) featuring Recharts timelines for risk scores and costs.
- Built the Compliance page (`/dashboard/compliance`) showing the regulation violation heatmap.
- Created the WebSocket gateway in the proxy service to stream events from Kafka to dashboard clients.

### Phase 1, Milestone 1.5 & 1.6 (Complete)
- **Policy Studio & Audit Vault**: Implemented `apps/policy-service` for rule CRUD and `apps/audit-service` for querying logs. Wired up Policy Studio UI and Audit Vault UI in the Dashboard.
- **SDKs & Integrations**: Created Python and Node.js SDKs, set up K8s manifests, and performed end-to-end load testing.

### Phase 1, MVP Bug Fixes & Refinements (Session 6 — 2026-08-30)
Hardened the MVP by resolving critical integration edge cases:
- **Provider Management**: Added `DELETE` API to `policy-service` and wired it to the Dashboard UI's Trash button to allow dynamic removal of API keys.
- **Model Routing**: Fixed the mock bypass condition in `upstream.ts` to strictly require `model === 'mock'`, allowing real custom local SLMs (e.g., Ollama) to be queried successfully.
- **Tri-Guard Scope**: Updated both streaming and non-streaming proxy interception to evaluate the *concatenated user prompt and LLM response*. This ensures Tri-Guard flags PII in the prompt even if the LLM refuses to generate a PII response.
- **Networking/IPv6 Fixes**: Modified `run-dev.ps1`, `upstream.ts`, `stream-interceptor.ts`, and `kafka.ts` to explicitly use `127.0.0.1` instead of `localhost`. This resolved recurring `ECONNREFUSED` errors caused by Node.js attempting to connect over IPv6 (`::1`) while Python/FastAPI services were bound to IPv4.

---

## Which Is Currently Being Worked On

**Status: Phase 1 (MVP) is 100% Complete — Ready to begin Phase 2, Milestone 2.1: SSO, RBAC & Multi-Tenant Hardening.**

### Next Up: Phase 2, Milestone 2.1 — SSO & RBAC

**Sprint work items (do these in order):**

1. [ ] Implement SAML 2.0 and OIDC SSO using `saml-jackson` integrated with NextAuth.js.
2. [ ] Add Role-Based Access Control (Admin, Policy Author, Auditor, Viewer) logic in the Dashboard and API routes.
3. [ ] Implement per-application API key scoping with granular permission flags in the Gateway.
4. [ ] Build the tenant provisioning flow (signup → workspace setup).
5. [ ] Add identity event logging (login, role change, key rotation) to the Audit Vault.

---

## Important Context & Constraints for AI

- All code must follow the rules defined in `Documentation/rules.md`. Read it before writing any code.
- The Tri-Guard latency budget is **<50ms per evaluation chunk (p99)**. Any implementation that cannot meet this must be flagged immediately.
- The proxy layer MUST maintain SSE streaming semantics — chunks must be forwarded to the client as they arrive from the upstream LLM, with only the evaluation latency added.
- Never make blocking synchronous calls to the Tri-Guard service from the Gateway's request hot path. All evaluation calls are async / non-blocking.
- Tenant isolation is non-negotiable. Every database query, Kafka topic, and cache key must be namespaced by tenant ID.
- Do NOT commit model artifacts (ONNX files) to git. They are gitignored and fetched from S3 on container startup.

---

## Glossary

| Term | Definition |
|---|---|
| Tri-Guard | The three-engine real-time evaluation system (Performance + Cost + Responsibility Guards) |
| Action Matrix | The decision engine that converts Guard verdicts into actions (Redact, Reroute, Flag, Block) |
| Evaluation Window | The sliding token buffer (default 50 tokens) fed to Guards per evaluation cycle |
| Tenant | An enterprise customer with isolated config, data, and policy set |
| Verdict | The output of a Guard evaluation: risk score (0–100) + list of triggered rules |
| WORM | Write Once Read Many — the immutability property required for Audit Vault storage |
| SLM | Small Language Model — the distilled evaluator models used for inline inference |
| Governed Output | The final, action-applied response delivered to the consuming application |