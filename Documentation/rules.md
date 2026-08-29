# Rules — ControlPlane.ai (Tri-Guard)

> These rules govern every engineering decision made on this project.
> Any AI assistant (Antigravity, Claude, Cursor, Copilot, etc.) working on this codebase MUST read and follow these rules before writing any code, making architectural decisions, or suggesting solutions.
> Violations are not acceptable — if a rule conflicts with a desired approach, raise the conflict explicitly rather than silently breaking the rule.

---

## 1. What to Use

### Languages & Runtimes

| Layer | Approved | Version Constraint |
|---|---|---|
| Gateway / Proxy Service | **TypeScript** (strict mode on) | Node.js >= 20 LTS, TypeScript >= 5.3 |
| Tri-Guard / Policy / Audit Services | **Python** | Python >= 3.11 (use 3.11 features: tomllib, ExceptionGroup, Self type) |
| Frontend / Dashboard | **TypeScript** (strict mode on) | Node.js >= 20 LTS |
| Infrastructure scripts | **Bash** (simple) or **Python** (complex) | No PowerShell in infra scripts — cross-platform compatibility |
| SQL Migrations | **SQL** via Alembic (Python services) | Never raw schema changes outside migrations |

### Gateway Service — Approved Libraries

| Purpose | Library | Why |
|---|---|---|
| HTTP Framework | `fastify` >= 4 | Lower overhead than Express, native schema validation, plugin ecosystem |
| Schema Validation | `@fastify/ajv-compiler` + `zod` | Zod for TypeScript-idiomatic validation at route layer |
| Auth | `@fastify/jwt` + custom API key middleware | Simple, auditable |
| Rate Limiting | `@fastify/rate-limit` + Redis backend | Distributed rate limiting across pods |
| Redis Client | `ioredis` | Mature, TypeScript-native, connection pooling |
| HTTP Client (upstream LLM) | `undici` (built into Node 18+) | Native fetch with streaming support; no axios |
| SSE Streaming | Native Node.js `stream` API | Do NOT use a third-party SSE library for the proxy hot path |
| Logging | `pino` | Structured JSON logging, zero overhead on production |
| Testing | `vitest` + `supertest` | Fast, ESM-native |

### Tri-Guard Service — Approved Libraries

| Purpose | Library | Why |
|---|---|---|
| HTTP Framework | `fastapi` >= 0.110 | Async-native, automatic OpenAPI docs, Pydantic v2 integration |
| Data Validation | `pydantic` v2 | Performance improvements over v1 critical for hot path |
| ML Inference | `onnxruntime` >= 1.17 | CPU-optimized inference; use `onnxruntime-gpu` only if GPU node explicitly provisioned |
| Embeddings | `sentence-transformers` (load via ONNX, not PyTorch in prod) | PyTorch is acceptable in dev/training, but prod inference must go through ONNX |
| PII Detection | `presidio-analyzer` + `presidio-anonymizer` >= 2.2 | Microsoft-maintained, extensible, multilingual |
| Tokenization | `tiktoken` (OpenAI models), `anthropic` tokenizer | Use the correct tokenizer per model — do not approximate |
| Async HTTP client | `httpx` with `AsyncClient` | Do NOT use `requests` anywhere in async code paths |
| Testing | `pytest` + `pytest-asyncio` + `httpx` (for FastAPI test client) | Standard async-aware test stack |
| Task Queue (if needed) | `anyio` task groups | Do not introduce Celery for intra-service parallelism — use asyncio task groups |

### Frontend — Approved Libraries

| Purpose | Library | Why |
|---|---|---|
| Framework | `next` >= 14 (App Router) | SSR for dashboard initial load; App Router for layout nesting |
| Auth | `next-auth` v5 (beta, but stable enough) | First-class Next.js integration; supports OIDC + SAML |
| Charts | `recharts` (standard charts) + `d3` (custom viz only) | Use Recharts for line/bar/area charts. Use D3 only for compliance heatmap |
| Data Fetching | Native `fetch` with Next.js cache tags | Do NOT introduce React Query or SWR unless fetch + cache proves insufficient |
| Real-time | Native browser `WebSocket` API via a custom hook | Do NOT use Socket.io — unnecessary abstraction over WebSocket |
| State Management | React `useState` + `useContext` + `useReducer` | Do NOT introduce Redux, Zustand, or Jotai unless state clearly exceeds React's built-ins |
| Styling | **Vanilla CSS** with CSS Custom Properties only | Absolutely NO Tailwind, styled-components, emotion, or CSS modules |
| Icons | `lucide-react` | Consistent, tree-shakeable, well-maintained |
| Form handling | `react-hook-form` | Performance-optimized, uncontrolled components |
| Animations | CSS transitions + `@keyframes` only | Do NOT introduce Framer Motion unless a specific animation clearly requires it |

### Data Stores — Approved

| Store | Approved Client Library |
|---|---|
| PostgreSQL | `asyncpg` (Python), `pg` (Node.js) |
| Redis | `redis-py` (Python), `ioredis` (Node.js) |
| Elasticsearch | `elasticsearch-py` (Python) >= 8.x |
| S3 | `boto3` (Python) with async via `aioboto3` |
| Kafka | `aiokafka` (Python), `kafkajs` (Node.js) |

### Infrastructure — Approved

| Tool | Version | Notes |
|---|---|---|
| Kubernetes | >= 1.28 | Use Deployment + HPA for all services. Never StatefulSet for app services. |
| Terraform | >= 1.6 | AWS provider >= 5.x |
| Docker | >= 25 | Multi-stage builds required for all production images |
| Helm | >= 3.12 | All K8s resources managed via Helm chart in Phase 2 |
| GitHub Actions | Latest | CI/CD pipeline. No CircleCI, no Jenkins. |

---

## 2. What to Avoid

### Architectural Anti-Patterns

| Anti-Pattern | Rule | Reason |
|---|---|---|
| **Synchronous evaluation in the hot path** | NEVER make a blocking synchronous HTTP call to the Tri-Guard service from the Gateway stream interception loop | This is the single biggest latency killer. All evaluation calls are async and fire-and-forget from the stream loop's perspective |
| **Full-response evaluation** | NEVER wait for the complete LLM response before running guards | Defeats the purpose. Guards must run on streaming chunks. If the full response is needed for a check, implement it as a post-response async job, not inline |
| **LLM-as-evaluator** | NEVER call a full LLM (GPT-4, Claude) to evaluate another LLM's output inline | Doubles latency, doubles cost, introduces a circular dependency. Distilled SLMs and heuristics only. |
| **Cross-tenant data access** | NEVER query data without a tenant_id filter | Every DB query, Elasticsearch query, Kafka topic, and Redis key must be scoped to a specific tenant |
| **Mutable audit events** | NEVER UPDATE or DELETE rows in the audit event store | Audit log is WORM (Write Once Read Many). Create new events; never mutate historical ones |
| **Raw SQL in application code** | NEVER write raw SQL strings outside of SQLAlchemy ORM or Alembic migrations | Use ORM for app queries; migrations for schema changes |
| **Storing PII in structured logs** | NEVER log full request/response content to structured logs (Pino, Python logging) | Only log hashes (SHA-256) of content. Raw content goes to encrypted S3 only |
| **Hardcoded model pricing** | NEVER hardcode token prices in application logic | Prices live in a config file / DB table that can be updated without deployment |
| **Monolithic services** | NEVER merge the Gateway and Tri-Guard services | They have different scaling characteristics, runtime environments, and failure modes |

### Library-Specific Bans

| Banned | Instead Use | Reason |
|---|---|---|
| `axios` (in Gateway) | `undici` / native `fetch` | axios wraps fetch unnecessarily; undici has better streaming support |
| `requests` (in Python async code) | `httpx.AsyncClient` | requests is synchronous; it blocks the asyncio event loop |
| PyTorch in production inference | `onnxruntime` | PyTorch binary is 1GB+; ONNX runtime is <100MB, faster on CPU |
| Tailwind CSS | Vanilla CSS + custom properties | Design system requires full token control; Tailwind's utility classes fight against it |
| Redux / Zustand | React built-ins (useState, useContext, useReducer) | Dashboard state complexity does not justify an external state library |
| `eval()` anywhere | Structured config / AST parsing | Security vulnerability; never acceptable |
| Synchronous Kafka producer in hot path | Async Kafka producer with fire-and-forget | Audit writes must never block the response stream |
| `print()` statements in production code | `logging` (Python) / `pino` (Node.js) | Structured, leveled, searchable logs only |

### Infrastructure Prohibitions

- Do NOT deploy without resource limits set (CPU + memory requests + limits on all K8s containers)
- Do NOT run database migrations as part of application startup — use a Kubernetes init job
- Do NOT use `latest` as a Docker image tag in any Kubernetes manifest — always use a specific digest or semver tag
- Do NOT expose the Tri-Guard internal evaluation API to the public internet — it must be internal-only, behind cluster network policy
- Do NOT store secrets in environment variable plaintext in Docker Compose for production — use Secrets Manager + External Secrets Operator

---

## 3. Error Handling Standards

### Gateway Service (TypeScript)

- **All async functions must handle errors explicitly**. No unhandled promise rejections.
- Use a global Fastify error handler that maps domain errors to structured HTTP responses.
- Define a `GovernanceViolationError` class for block actions — it must serialize to a stable JSON schema that SDK consumers can depend on:
  ```json
  {
    "error": {
      "type": "governance_violation",
      "code": "BLOCK_HIGH_RISK",
      "guard": "responsibility",
      "severity": "critical",
      "regulation": ["GDPR", "DPDP"],
      "message": "Output blocked due to high-severity PII leakage.",
      "request_id": "req_abc123"
    }
  }
  ```
- If the Tri-Guard service is **unavailable** (network error, timeout): **fail-open by default** — log the failure, pass the chunk through, emit a `GUARD_UNAVAILABLE` audit event. Do NOT fail the user request.
- If the Tri-Guard service is **unavailable** and tenant config has `fail_closed: true` — terminate the stream and return a `503 Service Unavailable` with a specific error code.
- All stream errors (upstream LLM errors, network drops) must be caught, logged, and surfaced to the client as a structured error response — never let a stream silently hang.

### Tri-Guard Service (Python)

- Use FastAPI exception handlers for all HTTP endpoints.
- Each Guard must run in a try/except. If a Guard fails internally, it returns a default "safe" verdict (score = 0, no rules triggered) — never raise an uncaught exception that kills the evaluation cycle.
- Log Guard failures with full stack trace at ERROR level, including the chunk content hash and tenant ID.
- ONNX inference errors must be caught. If the model file is corrupt or unavailable, the service must start with that Guard disabled (not crash), and log a CRITICAL-level alert.
- Use `pydantic` v2 for all request/response models — never accept or return untyped dicts from route handlers.

### Frontend (Next.js)

- All `fetch` calls in Server Components must handle errors with try/catch and return a typed error state — never propagate raw errors to the UI.
- Use Next.js `error.tsx` boundary files at the route segment level for graceful page-level error recovery.
- WebSocket disconnections must be handled with automatic exponential backoff reconnection (max 5 retries, starting at 1s, doubling, cap at 30s).
- Never display raw error stack traces in the UI. Errors shown to users must be user-friendly, actionable messages.

---

## 4. Boundaries for AI (Assistant Behavioral Rules)

These rules govern how any AI assistant (Antigravity, Claude, Cursor, etc.) must behave when working on this codebase.

### Mandatory Behaviors

1. **Read `memory.md` first** — Before taking any action in a session, read `Documentation/memory.md` to understand current state and what's next. Never assume — read.

2. **Read the relevant rule before writing code** — For any new component, read this file and the relevant section of `architecture.md` before generating code.

3. **Stay in scope** — Only implement what is specified in the current milestone from `phases.md`. Do not jump ahead to future milestones without explicit user instruction.

4. **One file at a time** — When generating code, do not generate more than 3 files in a single response. State explicitly which file you are working on and why, before generating it.

5. **Flag latency risks immediately** — If any implementation decision could push evaluation latency above 50ms p99, flag it with a `[LATENCY RISK]` warning in your response before proceeding.

6. **Flag tenant isolation risks** — If any code path could access cross-tenant data, flag it with a `[TENANT ISOLATION RISK]` warning.

7. **Update `memory.md` after completing a milestone** — At the end of every milestone, update the "What Has Been Completed" and "Which Is Currently Being Worked On" sections in `Documentation/memory.md`.

8. **Never silently break a rule** — If a rule in this file conflicts with an approach you believe is better, state the conflict explicitly and propose the exception. Do not just violate the rule without disclosure.

### Prohibited Behaviors

1. **Do NOT generate code that is not immediately usable** — No pseudocode, no placeholder functions with `// TODO: implement`, no stub logic in production paths. Either implement it properly or say you need more context.

2. **Do NOT rename established interfaces** — The `GovernanceViolationError` JSON schema, the `/v1/chat/completions` API path, and the Verdict data model are stable interfaces. Do not rename or restructure them without explicit user approval.

3. **Do NOT introduce new dependencies** without checking the approved library list in this file. If a needed library is not on the list, ask first.

4. **Do NOT run database migrations automatically** — Always present migration SQL for human review before suggesting it be run.

5. **Do NOT commit or suggest committing** ONNX model artifacts, `.env` files, or any file containing secrets.

6. **Do NOT suggest architectural changes** that contradict the decisions in `architecture.md` without a full written rationale of why the documented decision is wrong and what the tradeoffs of the change are.

7. **Do NOT generate UI code without the design system** — All frontend components must use only the CSS custom properties defined in `design.md`. No hardcoded hex values, no inline `font-size` values.

8. **Do NOT evaluate LLM output using another LLM** — this is both a rule (see anti-patterns above) and an AI constraint. If you find yourself suggesting "call GPT-4 to evaluate this", stop — it is wrong for this architecture.