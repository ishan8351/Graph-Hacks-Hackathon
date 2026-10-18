# Hackathon Plan: Shared Agent Memory + Company Brain

## Product direction

Position the project as a **source-grounded company memory that agents can read and update together**. The existing Active Engineering Memory Layer is a good proof of graph reasoning, but its current story is mostly three deterministic engineering scenarios. The winning demo should show one connected flow: ingest company evidence, ask a question, see the graph path and citations, hand the work to another agent, then resume with memory intact.

## What the two tracks require and what is missing today

| Track requirement | Current foundation | Gap to close |
|---|---|---|
| Episodic, semantic, procedural memory | Failure nodes are episodic; graph routes are procedural; decisions are semantic-like | No general memory API, explicit types, recall policy, decay/confidence, or multi-agent access |
| Persistent conversation history | Demo run history is saved in browser local storage | Not server-side, not available to agents, and not shared across devices or sessions |
| Shared state and agent handoffs | Agents share a tenant graph and deterministic scenarios | No handoff object, recipient, status, or resume/reclaim workflow |
| High-concurrency reads/writes | FalkorDB supports concurrent graph operations; mutations use Cypher | No idempotency keys, optimistic versioning, or concurrency behavior to demonstrate |
| Separate memory per user or tenant | FalkorDB graph-per-tenant | No user scope in memory records; tenant id alone is not authentication |
| Docs, tickets, and chats in one graph | Seed data includes synthetic Jira and review comments | No source ingestion/update API, source identity, freshness metadata, or citation surface |
| Ownership and expertise | Engineer/team/module graph and centrality lookup | Limited to seed data; no convenient question-to-entity lookup for arbitrary company data |
| Decisions traced to source | 3-hop decision -> ticket -> review -> author traversal | Only one hardcoded scenario, not a general answer workflow |
| Current knowledge | Demo mutations update routes | No source upsert/version/update or stale-source indicator |
| Answers with clear sources | Explainability drawer exposes a known path | No Company Brain Q&A endpoint or source-attributed answers |

### Highest-value improvements for judging

1. **Show a complete user journey, not a feature list.** Ask “Who owns the payment retry path, and why is batching unsafe?” Return an answer with the decision, incident, review comment, owner, graph path, and source identifiers.
2. **Make memory useful to a second agent.** Persist a conversation and create a handoff containing the task, decisions made, open questions, and recipient. A different agent resumes and recalls that context.
3. **Demonstrate all three memory types.** Record an execution as episodic memory, distill a reusable fact as semantic memory, and retain a verified route/checklist as procedural memory.
4. **Ingest and update evidence.** Provide a small API/UI to add documents, tickets, and chat excerpts with stable source IDs and timestamps; re-ingesting a source updates it instead of duplicating it.
5. **Prove isolation and concurrency.** Show separate tenant graphs and idempotent writes. Add version checks for handoffs so simultaneous agent updates cannot silently overwrite each other.
6. **Be explicit about limits.** The MVP uses deterministic graph retrieval and source-grounded synthesis; avoid claiming broad natural-language understanding until an LLM and retrieval evaluation are actually integrated.

## Implementation plan

### Phase A — Persistent, tenant-scoped agent memory (P0)

- [x] Define episodic, semantic, and procedural memory records with user, tenant, agent, session, timestamp, source, confidence, and idempotency metadata.
- [x] Add tenant-scoped memory write, recall, and conversation-history APIs; store records in FalkorDB, not browser state.
- [x] Add shared handoff create/list/update/resume operations with status and expected-version checks.
- [x] Make writes idempotent and safe for concurrent retries; use unique record IDs and atomic `MERGE`/version checks.
- [x] Add MCP tools so agents can remember, recall, and hand off state through the same service surface.

### Phase B — Company Brain ingestion and cited answers (P0)

- [x] Add source upsert for documents, tickets, and chat excerpts with stable source IDs, modified time, content, and URL/locator.
- [x] Connect sources to people, teams, projects, services, decisions, and incidents; record ownership and authored/approved relationships.
- [x] Add graph-grounded question answering that returns a concise answer, supporting entities, traversal evidence, and clickable source citations.
- [x] Rank evidence by query-term match and freshness; if evidence is missing, say so instead of inventing an answer.
- [x] Add local document and ticket-export ingestion for `.txt`, `.md`, `.json`, and `.csv` without external connectors.

### Phase C — UI and judge-ready proof (P1)

- [x] Add an Agent Memory/Company Brain workspace for asking, inspecting citations, writing a memory, and creating/resuming a handoff.
- [x] Display memory type, owner/agent, tenant, timestamp, source, confidence, and freshness in the graph/feed.
- [x] Add a two-agent LangGraph replay: Agent A reads evidence and persists a handoff; Agent B claims it, recalls the linked episode, and returns the same citations.
- [x] Add optional Gemini answer synthesis over retrieved graph excerpts, with deterministic graph fallback when no key is configured.
- [ ] Keep the three deterministic traces as demo modes; add a 90-second script and architecture/limitations slide to the README/demo capture.

### Phase D — Reliability and evaluation (P1/P2)

- [ ] Add API/schema tests for tenant isolation, idempotent retries, stale handoff versions, source updates, and citation completeness.
- [ ] Add concurrent read/write stress checks and latency metrics for recall and Q&A.
- [ ] Add authentication/authorization before treating user IDs as a security boundary; the current hackathon MVP only scopes records by caller-supplied user/tenant identifiers.
- [ ] Add source deletion/retention policy, privacy controls, and audit logs before production use.

## Current implementation status

The repository currently contains a FastAPI + LangGraph deterministic agent demo, a FalkorDB multigraph client, seeded engineering/company entities, self-healing route mutations, decision/source paths, expert centrality, SSE traces, a graph canvas, a Cypher workspace, and browser-local run history. Phases A and B are the implementation focus for this pass. UI and evaluation items remain follow-up work unless completed below.

### Work completed in this pass

- [x] Persistent typed agent memory and conversation history APIs
- [x] Shared versioned agent handoff API
- [x] Tenant-scoped knowledge-source upsert and graph links
- [x] Source-cited company question answering
- [x] MCP recall/remember/handoff tools
- [x] API and README usage notes

## Demo sequence to target

1. Ingest a policy document, incident ticket, and review chat with stable source IDs.
2. Ask: “Who owns PaymentRetryWorker, and why must we not batch charges?” Show the answer, owner, connected decision path, and citations.
3. Agent A saves the investigation as episodic memory, writes a semantic invariant, and hands off the follow-up to Agent B.
4. Agent B resumes from the handoff, recalls shared memory, verifies the same source path, and records the next action.
5. Repeat the query in another tenant and show that neither the memories nor sources cross the tenant boundary.

## Definition of a credible hackathon MVP

- A judge can add or update source content without editing seed code.
- A question returns inspectable graph evidence and source locators, not just plausible prose.
- A second agent can retrieve a prior conversation/memory and resume an explicitly versioned handoff.
- Tenant scope is present on every memory and source operation.
- The README explains the live demo flow, setup, API examples, limitations, and what is deterministic versus generated.
