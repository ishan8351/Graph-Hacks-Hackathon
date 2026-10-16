// ==============================================================================
// ACTIVE ENGINEERING MEMORY LAYER - GRAPH SCHEMA SPECIFICATION
// Graph Engine: FalkorDB (Cypher 9 / OpenCypher compliant)
// ==============================================================================
// This file serves as the definitive schema contract, indexing guide, and
// reference Cypher query catalog for the Active Engineering Memory Layer.
// It maps the socio-technical graph of an enterprise software engineering organization:
// Architecture Decision Records (ADRs), Code Modules, Microservices, Endpoints,
// Production Incidents, Git VCS Reviews, Jira Tickets, and Active Guardrails.
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. INDEXES AND CONSTRAINTS
// ------------------------------------------------------------------------------
// FalkorDB utilizes exact match and range indexing on node labels and properties
// to ensure sub-millisecond traversals during agent tool execution and guardrail checks.

// Node Identity & Lookup Indexes (Canonical Phase 1 & 2 Labels)
CREATE INDEX FOR (cm:CodeModule) ON (cm.name);
CREATE INDEX FOR (cm:CodeModule) ON (cm.id);

CREATE INDEX FOR (api:APIEndpoint) ON (api.name);
CREATE INDEX FOR (api:APIEndpoint) ON (api.id);

CREATE INDEX FOR (d:Decision) ON (d.id);
CREATE INDEX FOR (d:Decision) ON (d.status);

CREATE INDEX FOR (t:JiraTicket) ON (t.id);

CREATE INDEX FOR (c:VCSComment) ON (c.id);

CREATE INDEX FOR (eng:Engineer) ON (eng.id);
CREATE INDEX FOR (eng:Engineer) ON (eng.name);
CREATE INDEX FOR (eng:Engineer) ON (eng.email);

CREATE INDEX FOR (f:Failure) ON (f.id);
CREATE INDEX FOR (f:Failure) ON (f.session_id);

CREATE INDEX FOR (a:Agent) ON (a.name);

// Structural Topology & Governance Indexes
CREATE INDEX FOR (s:Service) ON (s.id);
CREATE INDEX FOR (s:Service) ON (s.name);

CREATE INDEX FOR (m:Module) ON (m.id);
CREATE INDEX FOR (m:Module) ON (m.name);

CREATE INDEX FOR (e:Endpoint) ON (e.id);
CREATE INDEX FOR (e:Endpoint) ON (e.path);

CREATE INDEX FOR (i:Incident) ON (i.id);
CREATE INDEX FOR (i:Incident) ON (i.severity);

CREATE INDEX FOR (g:Guardrail) ON (g.id);
CREATE INDEX FOR (g:Guardrail) ON (g.module_name);

CREATE INDEX FOR (sess:MemorySession) ON (sess.session_id);

// ------------------------------------------------------------------------------
// 2. NODE LABELS & PROPERTY DEFINITIONS
// ------------------------------------------------------------------------------

// ==============================================================================
// CANONICAL ACTIVE ENGINEERING MEMORY NODES (PHASE 1 & PHASE 2 CORE)
// ==============================================================================

// (:CodeModule)
// Internal architectural package, class, worker, or subsystem within a service domain.
// Primary anchor for guardrail validation, procedural steps, and ownership centrality.
// Properties:
//   - name: String ("PaymentRetryWorker", "TokenIngestionWorker", "webhook_router") [Indexed, Canonical Key]
//   - service: String ("billing-core", "auth-service", "svc_payment_gateway")
//   - file_path: String ("app/workers/payment_retry.py")
//   - description: String ("Background worker managing synchronous retry loop for settlement")

// (:APIEndpoint)
// Network API route exposed, called, or migrated across microservice architectures.
// Supports runtime self-healing, deprecation markers, and supersession links.
// Properties:
//   - name: String ("/v1/legacy-auth", "/v3/oauth/token", "/v1/charge/sync", "/v2/charge/batch") [Indexed, Canonical Key]
//   - method: String ("POST" | "GET" | "PUT" | "DELETE")
//   - status: String ("ACTIVE" | "DEPRECATED")
//   - service: String ("auth-service", "billing-core")
//   - latency_ms: Integer (35)
//   - deprecation_notice: String ("HTTP 410: Endpoint /v1/legacy-auth is discontinued. Migrate to /v3/oauth/token")

// (:Decision)
// Architecture Decision Record (ADR), constraint declaration, or high-stakes technical consensus.
// Documents active guardrails and intentional suboptimal workarounds preventing production regressions.
// Properties:
//   - id: String ("dec_19", "ADR-042") [Indexed, Canonical Key]
//   - status: String ("SUBOPTIMAL_WORKAROUND" | "ACCEPTED" | "SUPERSEDED" | "REJECTED") [Indexed]
//   - summary: String ("Force synchronous single-item polling loop instead of batching")
//   - title: String ("Deprecate V1 Webhook Polling in favor of Idempotent Event Gateway")
//   - decision: String ("Strictly prohibit batching or restoring legacy bank webhook routes.")
//   - context: String ("Bank partners drop duplicate webhooks or fail during batch operations > 1.")
//   - consequences: String ("Single-item synchronous loop required until partner upgrades core banking gateway.")
//   - created_at: String ("2026-04-12T10:00:00Z")

// (:JiraTicket)
// Issue tracker artifact representing root-cause bugs, incident postmortems, or technical debt remediation.
// Connects decisions to actual engineering track records.
// Properties:
//   - id: String ("PAY-409", "PAY-1049") [Indexed, Canonical Key]
//   - summary: String ("Batching webhooks failure mitigation and partner bank gateway drop postmortem")
//   - status: String ("CLOSED" | "RESOLVED" | "OPEN")
//   - ticket_type: String ("Bug" | "Task" | "Incident Postmortem")
//   - priority: String ("P0" | "P1" | "P2")

// (:VCSComment)
// Code review discussion, PR inline review comment, or commit warning left by an engineer.
// Explains subtle constraints, legacy pitfalls, and architectural caveats invisible to standard code analysis.
// Properties:
//   - id: String ("pr_882_c4", "vcs_pr_4492_cmt_102") [Indexed, Canonical Key]
//   - pr_number: Integer (882, 4492)
//   - author: String ("Aarav", "sarah.chen@enterprise.internal")
//   - text: String ("DO NOT upgrade to /v2/charge/batch here! Legacy partner bank gateway drops webhooks if batched > 1.")
//   - body: String ("Alias for text: DO NOT reintroduce synchronous bank webhook handlers without idempotency keys.")
//   - commit_sha: String ("a1f9e4b")
//   - created_at: String ("2026-05-04T14:22:10Z")

// (:Engineer)
// Human software engineer, staff architect, or domain lead responsible for code and decisions.
// Centrality nodes evaluated via PageRank to identify domain experts and decision provenance.
// Properties:
//   - id: String ("eng_1", "eng_sarah_chen") [Indexed, Canonical Key]
//   - name: String ("Aarav", "Maya", "Liam", "Sophia", "Sarah Chen") [Indexed]
//   - email: String ("aarav@enterprise.internal", "sarah.chen@enterprise.internal") [Indexed]
//   - role: String ("Staff Systems Architect", "Senior Platform Engineer")
//   - team: String ("Payments Core", "Authentication Squad")
//   - domain: String ("billing-core", "auth-service")
//   - github_handle: String ("aarav-arch", "schen-eng")

// (:Failure)
// Runtime execution failure episode logged dynamically by autonomous agents encountering API errors (e.g., HTTP 410).
// Participates in Graph Stigmergy to permanently mark degraded paths and prevent future agents from repeating mistakes.
// Properties:
//   - id: String ("fail_ep_001") [Indexed, Canonical Key]
//   - session_id: String ("sess_live_9941a") [Indexed]
//   - error: String ("HTTP 410: Endpoint /v1/legacy-auth is discontinued. Migrate to /v3/oauth/token")
//   - status_code: Integer (410)
//   - timestamp: String ("2026-10-16T06:05:00Z")

// (:Agent)
// Autonomous agent instance or swarm persona executing operational workflows, refactors, or evaluations.
// Properties:
//   - name: String ("RefactoringArchitectAgent", "PaymentWorkerAgent") [Indexed]
//   - session_id: String ("sess_live_9941a")
//   - role: String ("WorkerAgent" | "SupervisorAgent" | "AuditorAgent")

// ==============================================================================
// TOPOLOGY, GOVERNANCE & TELEMETRY NODES
// ==============================================================================

// (:Service)
// Top-level microservice or standalone repository.
// Properties:
//   - id: String ("svc_payment_gateway", "billing-core") [Indexed]
//   - name: String ("payment-gateway-service", "billing-core") [Indexed]
//   - repo_url: String ("git@github.com:enterprise/payment-gateway-service.git")
//   - language: String ("Python / FastAPI")
//   - tier: String ("Tier-1")
//   - status: String ("ACTIVE" | "DEPRECATED" | "MAINTENANCE")

// (:Team)
// Engineering organization team/squad owning domains or services.
// Properties:
//   - id: String ("team_payments_core")
//   - name: String ("Payments Core Team")
//   - domain: String ("Checkout & Settlement")

// (:Module)
// Structural alias for CodeModule used in legacy and high-level service topology mapping.
// Properties:
//   - id: String ("mod_payment_gateway_webhook_router") [Indexed]
//   - name: String ("webhook_router") [Indexed]
//   - file_path: String ("app/routers/webhooks.py")
//   - service_id: String ("svc_payment_gateway")

// (:Endpoint)
// Structural alias for APIEndpoint used in service route catalogs.
// Properties:
//   - id: String ("ep_post_v1_bank_webhook") [Indexed]
//   - method: String ("POST")
//   - path: String ("/api/v1/bank/webhook") [Indexed]
//   - service_id: String ("svc_payment_gateway")
//   - is_deprecated: Boolean (true | false)
//   - deprecation_notice: String ("HTTP 410: Bank gateway v1 webhooks permanently shut down in ADR-042")

// (:Incident)
// Historical production postmortem, outage, or critical regression.
// Properties:
//   - id: String ("INC-8821") [Indexed]
//   - title: String ("Double charge storm caused by fallback to unauthenticated v1 webhook route")
//   - severity: String ("SEV-1") [Indexed]
//   - root_cause: String ("AI assistant re-implemented fallback to deprecated v1 endpoint without idempotency check")
//   - date: String ("2026-05-01")
//   - financial_loss_usd: Float (185000.00)

// (:Guardrail)
// Active safety rule enforced deterministically before any code mutation or agent generation.
// Properties:
//   - id: String ("GR-PAY-001") [Indexed]
//   - name: String ("Legacy Webhook Protection Guardrail")
//   - module_name: String ("webhook_router", "PaymentRetryWorker") [Indexed]
//   - rule_type: String ("PROHIBIT_DEPRECATED_ENDPOINT_FALLBACK" | "CONSTRAINED_WORKAROUND_LOCK")
//   - enforcement_level: String ("BLOCK" | "WARN")
//   - description: String ("Prevents automated agents or developers from restoring deprecated v1 endpoints.")
//   - error_message: String ("Active Engineering Guardrail Triggered: Modifying webhook_router violates ADR-042.")

// (:MemorySession)
// Agent execution session tracking real-time reasoning and MCP tool invocations.
// Properties:
//   - session_id: String ("sess_live_9941a") [Indexed]
//   - agent_name: String ("RefactoringAgent")
//   - created_at: String ("2026-10-16T06:00:00Z")
//   - status: String ("IN_PROGRESS" | "COMPLETED" | "BLOCKED")

// ------------------------------------------------------------------------------
// 3. RELATIONSHIP TYPES
// ------------------------------------------------------------------------------

// ==============================================================================
// CANONICAL ACTIVE ENGINEERING MEMORY EDGES (PHASE 1 & PHASE 2 CORE)
// ==============================================================================
// - [:IMPLEMENTS]      (CodeModule) -> (Decision)
//                      Connects a code implementation or worker module to an architectural decision
//                      or intentional workaround (e.g., PaymentRetryWorker -> dec_19).
//
// - [:FORCED_BY]       (Decision) -> (JiraTicket)
//                      Links a decision or workaround to the historical Jira ticket, bug report,
//                      or postmortem that necessitated the policy (e.g., dec_19 -> PAY-409).
//
// - [:EXPLAINED_IN]    (JiraTicket) -> (VCSComment)
//                      Directs ticket context to code review comments, PR reviews, or commit notes
//                      containing detailed technical caveats (e.g., PAY-409 -> pr_882_c4).
//
// - [:AUTHORED]        (Engineer) -> (VCSComment | Decision | JiraTicket)
//                      Establishes author provenance and subject-matter accountability
//                      (e.g., Aarav -> pr_882_c4).
//
// - [:EXECUTES_STEP]   (CodeModule) -> (APIEndpoint)
//                      Procedural workflow execution edge defining the runtime API route used by a module.
//                      Properties:
//                        - status: String ("ACTIVE" | "BLOCKED")
//                        - weight: Float (1.0 for primary, 0.0 when blocked)
//                        - self_healed: Boolean (true when dynamically rerouted via stigmergy)
//
// - [:FALLBACK_STEP]   (CodeModule) -> (APIEndpoint)
//                      Standby alternative procedural execution edge available when primary route fails.
//                      Properties:
//                        - status: String ("STANDBY" | "ACTIVE")
//                        - weight: Float (0.5 standby weight)
//
// - [:SUPERSEDED_BY]   (APIEndpoint) -> (APIEndpoint)
//                      Explicit architectural migration pointer guiding autonomous agents from deprecated
//                      APIs to approved replacements (e.g., /v1/legacy-auth -> /v3/oauth/token).
//                      Properties:
//                        - confidence: Float (1.0)
//
// - [:DEPRECATES]      (Failure) -> (APIEndpoint)
//                      Graph stigmergy edge dynamically created when an agent encounters an unrecoverable
//                      runtime error (e.g., HTTP 410 Gone) to permanently mark the endpoint as invalid.
//                      Properties:
//                        - weight: Float (0.0)
//
// - [:LOGGED_EPISODE]  (Agent) -> (Failure)
//                      Audit trail edge linking an agent session to the failure episode it discovered.
//
// - [:RESOLVED]        (Engineer) -> (JiraTicket | Incident | Failure)
//                      Tracks remediation accomplishments by an engineer (factors into PageRank).
//
// - [:MAINTAINS]       (Engineer) -> (CodeModule | Service)
//                      Core code ownership relationship (highest weight in domain expert PageRank).
//
// - [:CONTRIBUTED_TO]  (Engineer) -> (CodeModule | Decision | JiraTicket)
//                      Collaborative engineering activity edge (contributes to PageRank centrality).

// ==============================================================================
// TOPOLOGY, GOVERNANCE & STRUCTURAL EDGES
// ==============================================================================
// - [:OWNS]            (Engineer | Team) -> (Service | CodeModule | Module)
// - [:MEMBER_OF]       (Engineer) -> (Team)
// - [:CONTAINS]        (Service) -> (CodeModule | Module)
// - [:EXPOSES]         (CodeModule | Service | Module) -> (APIEndpoint | Endpoint)
// - [:CALLS]           (CodeModule | Module) -> (APIEndpoint | Endpoint)
// - [:DEPENDS_ON]      (Service) -> (Service)
// - [:GOVERNS]         (Decision) -> (Service | CodeModule | Module | APIEndpoint | Endpoint)
// - [:MITIGATES]           (Decision) -> (Incident)
// - [:SUPERSEDES]          (Decision) -> (Decision)
// - [:DOCUMENTED_BY]       (Decision | Incident) -> (JiraTicket)
// - [:REFERENCES]          (VCSComment) -> (Decision)
// - [:PROTECTS]            (Guardrail) -> (CodeModule | Module | Service | APIEndpoint | Endpoint)
// - [:ENFORCES]            (Guardrail) -> (Decision)
// - [:RESOLVED_BY]         (Incident) -> (Decision)

// ------------------------------------------------------------------------------
// 4. CORE CYPHER QUERY PATTERNS (ACTIVE MEMORY REASONING)
// ------------------------------------------------------------------------------

// ==============================================================================
// PATTERN 1: 3-HOP CONSTRAINT GUARDRAIL TRAVERSAL (PHASE 1 CANONICAL)
// ==============================================================================
// Architectural Rationale:
// When an automated agent attempts to refactor code (e.g., "optimize" PaymentRetryWorker
// to use batching instead of single-item polling), standard Vector RAG fails:
// Vector similarity looks for "batch payments" and misses the historical, non-obvious
// partner bank limitation that silently drops webhooks if batched > 1.
// FalkorDB executes this deterministic 3-hop traversal in sub-millisecond time:
// (CodeModule)-[:IMPLEMENTS]->(Decision)-[:FORCED_BY]->(JiraTicket)-[:EXPLAINED_IN]->(VCSComment)<-[:AUTHORED]-(Engineer)

// Cypher Query:
// MATCH path = (m:CodeModule {name: $module_name})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(v:VCSComment)<-[:AUTHORED]-(e:Engineer)
// RETURN d.id AS decision_id,
//        d.status AS decision_status,
//        d.summary AS decision_summary,
//        j.id AS jira_ticket,
//        v.id AS vcs_comment_id,
//        coalesce(v.text, v.body) AS vcs_comment_text,
//        e.id AS engineer_id,
//        e.name AS engineer_name,
//        e.role AS engineer_role,
//        [node in nodes(path) | coalesce(node.name, node.id)] AS path_nodes;

// Example Instantiation (Phase 1 Seed):
// (:CodeModule {name: 'PaymentRetryWorker'})
//   -[:IMPLEMENTS]-> (:Decision {id: 'dec_19', status: 'SUBOPTIMAL_WORKAROUND', summary: 'Force synchronous single-item polling loop instead of batching'})
//   -[:FORCED_BY]-> (:JiraTicket {id: 'PAY-409'})
//   -[:EXPLAINED_IN]-> (:VCSComment {id: 'pr_882_c4', text: 'DO NOT upgrade to /v2/charge/batch here! Legacy partner bank gateway drops webhooks if batched > 1.'})
//   <-[:AUTHORED]- (:Engineer {id: 'eng_1', name: 'Aarav', role: 'Staff Systems Architect'})

// ==============================================================================
// PATTERN 2: SELF-HEALING PROCEDURAL WORKFLOW TOPOLOGY (GRAPH STIGMERGY)
// ==============================================================================
// Architectural Rationale:
// In distributed systems, APIs deprecate over time (e.g. /v1/legacy-auth returns HTTP 410 Gone).
// Rather than hardcoding static configuration, Active Engineering Memory applies biological
// stigmergy: when an agent hits an error, it mutates the graph to mark the path as blocked,
// leaves a deprecation marker, and promotes the standby/superseded replacement (/v3/oauth/token).
// Subsequent agent executions instantly read the self-healed path without repeating the error.

// Pattern 2A: Query Active Procedural Route & Standby Fallbacks (MCP Tool 1)
// MATCH (m:CodeModule {name: $module_name})-[r:EXECUTES_STEP]->(primaryApi:APIEndpoint)
// OPTIONAL MATCH (f:Failure)-[:DEPRECATES]->(primaryApi)
// OPTIONAL MATCH (primaryApi)-[:SUPERSEDED_BY]->(replacementApi:APIEndpoint)
// OPTIONAL MATCH (m)-[:FALLBACK_STEP]->(fallbackApi:APIEndpoint)
// RETURN primaryApi.name AS primary_endpoint,
//        primaryApi.status AS primary_status,
//        r.status AS step_status,
//        r.weight AS step_weight,
//        replacementApi.name AS superseded_replacement,
//        fallbackApi.name AS fallback_endpoint,
//        f.error AS failure_reason;

// Pattern 2B: Atomic Stigmergy & Self-Healing Procedural Mutation (MCP Tool 2)
// MATCH (m:CodeModule {name: $module_name})-[r:EXECUTES_STEP]->(oldApi:APIEndpoint {name: $failed_endpoint})
// SET r.status = 'BLOCKED', r.weight = 0.0, oldApi.status = 'DEPRECATED'
// MERGE (a:Agent {name: $agent_name})
// CREATE (f:Failure {id: $ep_id, session_id: $session_id, error: $error_message, timestamp: $timestamp})
// MERGE (a)-[:LOGGED_EPISODE]->(f)
// MERGE (f)-[:DEPRECATES {weight: 0.0}]->(oldApi)
// MERGE (newApi:APIEndpoint {name: $replacement_endpoint})
// MERGE (oldApi)-[:SUPERSEDED_BY {confidence: 1.0}]->(newApi)
// MERGE (m)-[:EXECUTES_STEP {status: 'ACTIVE', weight: 1.0, self_healed: true}]->(newApi)
// RETURN m.name AS module_name,
//        oldApi.name AS deprecated_endpoint,
//        newApi.name AS active_endpoint,
//        f.id AS failure_id;

// ==============================================================================
// PATTERN 3: PAGERANK CENTRALITY GRAPH & DOMAIN EXPERTISE DISCOVERY
// ==============================================================================
// Architectural Rationale:
// When high-stakes architectural guardrails trigger, autonomous agents or developers need
// immediate access to the true domain authority. The collaboration graph models real ownership
// via [:MAINTAINS], [:AUTHORED], [:RESOLVED], and [:CONTRIBUTED_TO] relationships.
// Aarav accumulates highest centrality in billing-core due to authored decisions and maintenance edges.

// Pattern 3A: Weighted Relational Centrality Traversal (MCP Tool 4)
// MATCH (m:CodeModule {name: $module_name})
// MATCH (eng:Engineer)
// OPTIONAL MATCH (eng)-[r_maint:MAINTAINS]->(m)
// OPTIONAL MATCH (m)-[:IMPLEMENTS]->(d:Decision)<-[r_auth:AUTHORED]-(eng)
// OPTIONAL MATCH (eng)-[r_contrib:CONTRIBUTED_TO]->(m)
// WITH eng,
//      count(r_maint) * 3 + count(r_auth) * 2 + count(r_contrib) * 1 AS centrality_score,
//      count(r_maint) AS maintains_count,
//      count(r_auth) AS authored_count,
//      count(r_contrib) AS contributed_count
// WHERE centrality_score > 0
// RETURN eng.id AS engineer_id,
//        eng.name AS engineer_name,
//        eng.role AS engineer_role,
//        centrality_score,
//        maintains_count,
//        authored_count,
//        contributed_count
// ORDER BY centrality_score DESC
// LIMIT 1;

// Pattern 3B: FalkorDB Native PageRank Algorithm
// CALL algo.pageRank('Engineer', 'MAINTAINS|AUTHORED|RESOLVED|CONTRIBUTED_TO')
// YIELD node, score
// RETURN node.id AS engineer_id, node.name AS engineer_name, node.role AS role, score
// ORDER BY score DESC;

// ==============================================================================
// PATTERN 4: DOWNSTREAM BLAST RADIUS & DEPENDENCY ANALYSIS
// ==============================================================================
// Evaluates blast radius when modifying or deprecating an upstream service or module:
// MATCH path = (upstream:Service {id: $service_id})<-[:DEPENDS_ON*1..3]-(downstream:Service)
// RETURN downstream.name AS affected_service,
//        length(path) AS hop_distance,
//        [n in nodes(path) | n.name] AS dependency_chain;

// ==============================================================================
// PATTERN 5: ARCHITECTURAL GUARDRAIL INVARIANT CHECK FOR TARGET MODULE
// ==============================================================================
// Verifies if a module is protected by active guardrails, linking to governing ADRs,
// past incident postmortems, Jira remediation tickets, and lead engineer authors:
// MATCH (g:Guardrail)-[:PROTECTS]->(m:CodeModule {name: $module_name})
// MATCH (g)-[:ENFORCES]->(d:Decision)-[:MITIGATES]->(inc:Incident)
// MATCH (d)-[:DOCUMENTED_BY]->(jira:JiraTicket)
// MATCH (eng:Engineer)-[:AUTHORED]->(d)
// OPTIONAL MATCH (cmt:VCSComment)-[:REFERENCES]->(d)
// RETURN g.id AS guardrail_id,
//        m.name AS module_name,
//        d.id AS decision_id,
//        d.title AS decision_title,
//        jira.id AS jira_ticket,
//        inc.id AS incident_id,
//        coalesce(cmt.text, cmt.body) AS vcs_comment,
//        eng.name AS engineer_owner,
//        [g.id, m.name, d.id, inc.id, jira.id] AS path_nodes;
