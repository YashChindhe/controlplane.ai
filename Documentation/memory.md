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

## Which Is Currently Being Worked On

**Status: Phase 1, Milestone 1.1 Complete — Ready to begin Milestone 1.2 stream interception & evaluation loop.**

### Next Up: Phase 1, Milestone 1.2 — Tri-Guard Service Foundation & Stream Interception

**Sprint work items (do these in order):**

1. [ ] Set up `apps/tri-guard/` — Python FastAPI service skeleton with gRPC/HTTP endpoint
2. [ ] Stub out the three Guard modules (Performance, Cost, Responsibility) with mock scorers
3. [ ] Implement stream-interceptor.ts in `apps/gateway` with a sliding 50-token evaluation window
4. [ ] Wire stream-interceptor.ts to call the Tri-Guard service per window asynchronously
5. [ ] Implement Verdict Aggregator and Action Matrix resolver in gateway
6. [ ] Set up Kafka in docker-compose for async audit logging
7. [ ] Verify chunk redaction, event logging, and blocking responses (GovernanceViolationError)

**Do NOT start**: Dashboard UI, Policy Studio, Audit Vault, SDKs — these are Milestone 3+ work.

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