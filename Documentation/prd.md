# Project Requirements Document — ControlPlane.ai (Tri-Guard)

---

## 1. What to Build

**ControlPlane.ai** is an enterprise-grade, model-agnostic **AI Output Governance Platform** built around a core engine called **Tri-Guard** — a real-time, inline oversight layer that intercepts every token stream from any LLM and evaluates it across three risk dimensions simultaneously, in under 50 milliseconds, before the output reaches the consuming application or end user.

The platform is not a post-hoc auditing tool, a periodic batch scanner, or a model evaluation harness. It is a **live trust layer** — a transparent, non-blocking middleware proxy that sits between any LLM provider (OpenAI, Anthropic, Gemini, Mistral, Azure OpenAI, Bedrock, self-hosted models) and the enterprise applications that consume their outputs.

### Core Engine — Tri-Guard Evaluator

The Tri-Guard Evaluator is a streaming interception pipeline with three parallel micro-check engines running concurrently on every partial chunk of generated text:

1. **Performance Guard** — Detects hallucinations, factual inconsistencies, uncalibrated confidence expressions, and logical contradictions in real time. Uses distilled SLM (Small Language Model) evaluators trained specifically for factual grounding and confidence calibration — not a second full LLM call. Returns a Performance Risk Score (0–100) per chunk, with cumulative drift tracking across the full response.

2. **Cost Guard** — Detects token bloat, verbose over-generation, redundant re-prompting patterns, and wrong-model-for-task routing. Uses a semantic density evaluator and a model-capability router. Capable of mid-stream rerouting of output to a cheaper or specialized model tier when over-generation is detected. Returns a Cost Efficiency Score and projected token overage signal.

3. **Responsibility Guard** — Detects PII leakage (names, emails, phone numbers, financial identifiers, health data), demographic bias signals, and regulatory compliance drift (GDPR, DPDP, EU AI Act, HIPAA, SOC 2). Uses a regex + embedding hybrid policy engine that is tenant-configurable. Returns a Responsibility Risk Score and a specific violation taxonomy per detection.

All three evaluators run **in parallel on partial streaming chunks** (not on the full completed response) — meaning verdicts are returned before generation finishes.

### The Action Matrix

When one or more risk signals exceed configurable thresholds, the Action Matrix applies one of four automatic resolutions:

| Action | Trigger Condition | Behavior |
|---|---|---|
| **Silent Redact / Mask** | Low severity + reversible | Auto-masks PII, trims bloat, inline replacement — zero user-facing disruption |
| **Reroute** | Wrong-sized model for task | Mid-stream redirect to cheaper or specialized model tier, transparent to caller |
| **Flag + Shadow Log** | Non-blocking risk, compliance-relevant | Output delivered; event logged to immutable audit trail for async review |
| **Block + Escalate** | High-stakes, irreversible risk | Stream halted; human-in-the-loop escalation triggered; caller receives structured error |

### Platform Surface Areas

Beyond the core engine, ControlPlane.ai exposes:

- **Governance Dashboard** — Real-time observability UI: live token stream monitoring, risk score timelines, incident feed, model performance comparisons, cost analytics, compliance posture heatmaps.
- **Policy Studio** — No-code / low-code policy authoring UI where compliance officers and AI leads can define, version, and deploy custom rules for each Guard without touching code.
- **Audit Vault** — Immutable, tamper-evident log store for every intercepted output event, verdict, action taken, and user context. Exportable for regulatory audits.
- **SDK / Proxy API** — Drop-in OpenAI-compatible proxy endpoint (same API contract) so existing integrations require zero application-layer changes.
- **Alert & Escalation Engine** — Configurable webhooks, Slack/Teams/PagerDuty integrations for high-severity escalations.

---

## 2. Targeted Users

### Primary Personas

#### A. Enterprise AI Platform / ML Engineering Teams
- **Role**: Build and operate internal LLM-powered products (copilots, document Q&A, code assistants, workflow automation).
- **Pain**: No real-time visibility into what models are actually outputting in production. Incidents discovered via user complaints or post-hoc log digs.
- **Need**: A zero-friction proxy layer they can drop in front of their model calls without re-architecting. Rich telemetry on model behavior, cost efficiency, and safety posture.
- **Technical Profile**: Comfortable with APIs, SDKs, Docker, cloud infra. Will own integration.

#### B. Chief AI Officer / VP of AI (Executive Sponsor)
- **Role**: Accountable for AI strategy, compliance posture, and the business risk profile of deployed AI systems.
- **Pain**: Cannot answer "Is our AI safe right now?" with real-time confidence. Board-level AI governance requirements increasing.
- **Need**: An executive dashboard showing real-time trust posture across all AI deployments. Audit-ready compliance reports.
- **Technical Profile**: Non-technical. Needs summary views, risk scores, trend lines.

#### C. Data Privacy & Compliance Officers
- **Role**: Ensure enterprise AI deployments comply with GDPR, DPDP, EU AI Act, HIPAA, SOC 2.
- **Pain**: AI outputs are a new, uncontrolled data exfiltration and bias vector. No tooling exists to govern them in real time.
- **Need**: PII detection, redaction, bias flagging, and a regulatory-grade audit trail. Policy authoring without engineering dependency.
- **Technical Profile**: Non-technical. Owns policy definitions, reviews audit reports.

#### D. Security & Risk Teams
- **Role**: Maintain organizational data security posture.
- **Pain**: LLM outputs can leak sensitive internal data, embed prompt injection artifacts, or produce outputs that violate security policies.
- **Need**: Real-time blocking of high-risk outputs, full audit trail, anomaly alerting.
- **Technical Profile**: Semi-technical. Uses dashboards and alert feeds.

#### E. FinOps / Cloud Cost Teams
- **Role**: Optimize cloud AI spend.
- **Pain**: Token bloat, premium model over-use, and redundant re-prompting are silently burning budget.
- **Need**: Real-time cost efficiency scoring, mid-stream rerouting to cheaper models, cost analytics by team/application/model.
- **Technical Profile**: Non-technical. Uses dashboards and cost reports.

### Target Industries (Initial)
- Financial Services (highest compliance pressure, highest hallucination risk)
- Healthcare (HIPAA, high PII sensitivity)
- Legal Tech (factual accuracy critical)
- Enterprise SaaS (AI-native products, scale cost pressure)
- Government / Public Sector (EU AI Act, DPDP compliance)

### Company Profile (ICP)
- Enterprises with 500+ employees actively deploying GenAI in production
- Running $10k+/month in LLM API spend
- Operating in regulated industries or with meaningful data privacy obligations
- Currently using OpenAI, Azure OpenAI, Anthropic, or Bedrock

---

## 3. Features

### Core Features (MVP — Phase 1)

#### F-01: Model-Agnostic Proxy Layer
- OpenAI-compatible REST API proxy endpoint
- Supports streaming (SSE) and non-streaming responses
- Drop-in integration: change base URL, no application code changes required
- Supports: OpenAI, Anthropic, Azure OpenAI, Google Gemini, Mistral, AWS Bedrock
- Tenant isolation: each API key scoped to a tenant with its own policy set

#### F-02: Real-Time Token Stream Interception
- Intercepts SSE token streams mid-generation
- Processes tokens in configurable chunk sizes (default: 50 tokens per evaluation window)
- Evaluation latency budget: <50ms per chunk (p99)
- Non-blocking by default: stream continues while evaluation runs async
- Blocking mode configurable per policy rule for high-risk rule classes

#### F-03: Performance Guard Engine
- Distilled SLM-based hallucination detector (fine-tuned on TruthfulQA, HaluEval, FActScore benchmarks)
- Contradiction detector: flags logical inconsistencies within the same response
- Confidence calibration monitor: flags overconfident assertions on uncertain facts
- Per-chunk Performance Risk Score (0–100) + response-level aggregate
- Optional RAG context injection for grounded factual verification

#### F-04: Cost Guard Engine
- Real-time token count and projected total cost estimator (per model pricing table)
- Semantic density scorer: detects verbose over-generation vs. information content ratio
- Model-task fit evaluator: scores whether current model tier is appropriate for detected task complexity
- Mid-stream rerouting: if model-task mismatch detected, seamless redirect to cheaper model tier
- Per-request cost breakdown: input tokens, output tokens, model tier, projected vs. actual spend

#### F-05: Responsibility Guard Engine
- PII detection: 40+ entity types (names, emails, phone, SSN, IBAN, health IDs, biometric references)
- Regex + embedding hybrid policy engine for high recall on structured and unstructured PII
- Demographic bias signal detector: flags outputs with differential treatment on protected attributes
- Regulatory tag mapping: each detected violation tagged with applicable regulation (GDPR Art. 9, DPDP Sec. 8, HIPAA 164, EU AI Act Art. 10)
- Tenant-configurable policy sets via Policy Studio

#### F-06: Action Matrix Execution
- **Silent Redact/Mask**: Inline regex substitution + token-level PII masking, transparent to consumer
- **Reroute**: Mid-stream model switch; upstream buffer held, re-generation on new model, seamless handoff
- **Flag + Shadow Log**: Non-blocking; event written to Audit Vault with full context
- **Block + Escalate**: Stream terminated; caller receives structured GovernanceViolation error; escalation webhook fired
- All actions configurable per rule, per tenant, per application

#### F-07: Governance Dashboard (Web UI)
- Real-time live feed of intercepted outputs with risk scores (last 100 events, auto-refreshing)
- Risk score timelines: Performance, Cost, Responsibility trends (1h, 24h, 7d, 30d)
- Incident feed: filterable list of flagged, blocked, rerouted events
- Model performance comparison: side-by-side accuracy, cost, and responsibility scores per model
- Cost analytics: daily/weekly token spend by model, application, team
- Compliance posture heatmap: risk exposure by regulation by day

#### F-08: Policy Studio (Web UI)
- Visual rule builder: define conditions (field, operator, value/threshold) and actions
- Rule versioning: full history of policy changes with author, timestamp, diff view
- Rule testing sandbox: paste sample output, dry-run against current policy, see which rules trigger
- Staged deployment: rules deployable to staging before production promotion
- Pre-built rule templates: GDPR PII pack, HIPAA data pack, EU AI Act Annex III pack

#### F-09: Audit Vault
- Append-only, tamper-evident event log (WORM-compliant storage)
- Every event stores: timestamp, tenant ID, application ID, request hash, response hash, risk scores, action taken, rules triggered, hashed user context
- Full-text search across audit events
- Export: CSV, JSON, PDF compliance report formats
- Configurable retention (minimum 12 months)

#### F-10: SDK & Integrations
- Python SDK (pip install controlplane-ai)
- Node.js SDK (npm install @controlplane/ai)
- Webhook integrations: Slack, Microsoft Teams, PagerDuty, Datadog, Splunk
- SIEM connector: forward audit events to Splunk/Elastic in CEF format

### Extended Features (Phase 2)

#### F-11: Prompt Injection Detection
- Detect adversarial prompt injection attempts in incoming requests
- Flag and block requests attempting to override system prompts or exfiltrate context

#### F-12: Model Benchmarking Suite
- Run standardized evals (MMLU, TruthfulQA, BBH) against any configured model endpoint
- Track model quality regression over time

#### F-13: Agentic Workflow Guard
- Multi-step agent/tool-call chain monitoring
- Detect loops, runaway cost escalation, or pre-execution of irreversible tool actions
- Mid-chain intervention: pause and escalate before irreversible side effects

#### F-14: RAG Quality Guard
- Evaluate retrieval quality: detect when retrieved chunks are semantically irrelevant
- Flag low-grounding responses where the model ignores or contradicts retrieved context

#### F-15: Multi-Tenant SSO & RBAC
- SAML 2.0 / OIDC SSO integration
- Role-based access: Admin, Policy Author, Auditor, Viewer
- Per-application API key scoping with granular permissions