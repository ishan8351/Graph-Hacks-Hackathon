"""
Active Engineering Memory Layer - Synthetic Enterprise Seed Engine
===================================================================
Populates a realistic enterprise socio-technical knowledge graph in FalkorDB.
This synthetic topology models an enterprise payments platform with ~40-60 nodes:
- 3 Microservices (Billing, Auth, Notifications)
- 8 API Endpoints
- 6 Jira Tickets
- 8 VCS PR Comments
- 4 Engineers
- 3 Architecture Decisions (ADRs)
- 6 Code Modules
- 3 Active Guardrails
- 3 Production Incidents
- 3 Engineering Teams

Canonical Graph Patterns Included:
1. 3-Hop Constraint Guardrail:
   (PaymentRetryWorker)-[:IMPLEMENTS]->(dec_19)-[:FORCED_BY]->(PAY-409)-[:EXPLAINED_IN]->(pr_882_c4)<-[:AUTHORED]-(Aarav)
   Prevents AI agents from upgrading PaymentRetryWorker to batch APIs that drop bank webhooks.
2. Self-Healing Procedural Workflow Topology:
   (TokenIngestionWorker)-[:EXECUTES_STEP]->(/v1/legacy-auth)
   (TokenIngestionWorker)-[:FALLBACK_STEP]->(/v3/oauth/token)
   (/v1/legacy-auth)-[:SUPERSEDED_BY]->(/v3/oauth/token)
3. Engineer Collaboration Network (PageRank Centrality):
   Aarav (Staff Systems Architect) holds the highest degree/PageRank centrality in the billing domain.
"""

from typing import Any, Dict
from app.db.graph_client import FalkorDBClient


def seed_tenant_graph(client: FalkorDBClient, tenant_id: str) -> Dict[str, Any]:
    """
    Reset and seed a tenant graph with the enterprise active memory topology.

    Args:
        client: Connected FalkorDBClient instance.
        tenant_id: Target tenant graph namespace.

    Returns:
        Summary dict containing status, node_count, and edge_count.
    """
    # 1. Reset target graph cleanly
    client.reset_graph(tenant_id=tenant_id)

    # 2. Schema indexes for rapid traversal
    index_statements = [
        "CREATE INDEX FOR (d:Decision) ON (d.id)",
        "CREATE INDEX FOR (s:Service) ON (s.id)",
        "CREATE INDEX FOR (m:CodeModule) ON (m.name)",
        "CREATE INDEX FOR (e:APIEndpoint) ON (e.name)",
        "CREATE INDEX FOR (t:JiraTicket) ON (t.id)",
        "CREATE INDEX FOR (c:VCSComment) ON (c.id)",
        "CREATE INDEX FOR (eng:Engineer) ON (eng.name)",
        "CREATE INDEX FOR (g:Guardrail) ON (g.id)",
    ]
    for idx_cypher in index_statements:
        client.query(idx_cypher, tenant_id=tenant_id)

    # 3. Create Teams
    teams_cypher = """
    CREATE (t1:Team {id: 'team_payments', name: 'Payments Core', domain: 'Billing & Settlement'})
    CREATE (t2:Team {id: 'team_platform', name: 'Platform Infrastructure', domain: 'Core Infra & SRE'})
    CREATE (t3:Team {id: 'team_security', name: 'Security Engineering', domain: 'IAM & Compliance'})
    """
    client.query(teams_cypher, tenant_id=tenant_id)

    # 4. Create Engineers
    engineers_cypher = """
    CREATE (eng1:Engineer {
        id: 'eng_1',
        name: 'Aarav',
        role: 'Staff Systems Architect',
        email: 'aarav@enterprise.internal',
        domain: 'billing-core'
    })
    CREATE (eng2:Engineer {
        id: 'eng_2',
        name: 'Maya',
        role: 'Principal Reliability Engineer',
        email: 'maya@enterprise.internal',
        domain: 'platform-sre'
    })
    CREATE (eng3:Engineer {
        id: 'eng_3',
        name: 'Liam',
        role: 'Senior Backend Engineer',
        email: 'liam@enterprise.internal',
        domain: 'billing-core'
    })
    CREATE (eng4:Engineer {
        id: 'eng_4',
        name: 'Sophia',
        role: 'Security & Platform Lead',
        email: 'sophia@enterprise.internal',
        domain: 'security-iam'
    })
    """
    client.query(engineers_cypher, tenant_id=tenant_id)

    # 5. Create Services
    services_cypher = """
    CREATE (s1:Service {
        id: 'svc_billing',
        name: 'billing-core-service',
        language: 'Python/FastAPI',
        tier: 'Tier-1',
        status: 'ACTIVE'
    })
    CREATE (s2:Service {
        id: 'svc_auth',
        name: 'identity-auth-service',
        language: 'Go',
        tier: 'Tier-1',
        status: 'ACTIVE'
    })
    CREATE (s3:Service {
        id: 'svc_notif',
        name: 'event-notification-service',
        language: 'Node.js/TypeScript',
        tier: 'Tier-2',
        status: 'ACTIVE'
    })
    """
    client.query(services_cypher, tenant_id=tenant_id)

    # 6. Create Code Modules
    modules_cypher = """
    CREATE (m1:CodeModule {
        id: 'mod_payment_retry',
        name: 'PaymentRetryWorker',
        file_path: 'billing/workers/retry.py',
        domain: 'billing-core'
    })
    CREATE (m2:CodeModule {
        id: 'mod_token_ingest',
        name: 'TokenIngestionWorker',
        file_path: 'auth/workers/token.py',
        domain: 'security-iam'
    })
    CREATE (m3:CodeModule {
        id: 'mod_webhook_sig',
        name: 'WebhookSignatureValidator',
        file_path: 'billing/security/signature.py',
        domain: 'billing-core'
    })
    CREATE (m4:CodeModule {
        id: 'mod_billing_ledger',
        name: 'BillingLedgerProcessor',
        file_path: 'billing/services/ledger.py',
        domain: 'billing-core'
    })
    CREATE (m5:CodeModule {
        id: 'mod_notif_dispatch',
        name: 'NotificationDispatcher',
        file_path: 'notif/dispatcher.ts',
        domain: 'notifications'
    })
    CREATE (m6:CodeModule {
        id: 'mod_audit_collector',
        name: 'AuditLogCollector',
        file_path: 'infra/audit/collector.py',
        domain: 'platform-sre'
    })
    """
    client.query(modules_cypher, tenant_id=tenant_id)

    # 7. Create 8 API Endpoints
    endpoints_cypher = """
    CREATE (e1:APIEndpoint {
        id: 'ep_legacy_auth',
        name: '/v1/legacy-auth',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: true
    })
    CREATE (e2:APIEndpoint {
        id: 'ep_oauth_v3',
        name: '/v3/oauth/token',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    CREATE (e3:APIEndpoint {
        id: 'ep_charge_single',
        name: '/v1/charge/single',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    CREATE (e4:APIEndpoint {
        id: 'ep_charge_batch',
        name: '/v2/charge/batch',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    CREATE (e5:APIEndpoint {
        id: 'ep_bank_webhook',
        name: '/v1/webhooks/bank',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    CREATE (e6:APIEndpoint {
        id: 'ep_refunds',
        name: '/v1/refunds',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    CREATE (e7:APIEndpoint {
        id: 'ep_notif_dispatch',
        name: '/v2/notifications/dispatch',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    CREATE (e8:APIEndpoint {
        id: 'ep_audit_logs',
        name: '/v1/audit/logs',
        method: 'POST',
        status: 'ACTIVE',
        is_deprecated: false
    })
    """
    client.query(endpoints_cypher, tenant_id=tenant_id)

    # 8. Create 3 Decisions (ADRs)
    decisions_cypher = """
    CREATE (d1:Decision {
        id: 'dec_19',
        title: 'Retain Synchronous Payment Polling for Legacy Bank Partner',
        status: 'SUBOPTIMAL_WORKAROUND',
        summary: 'Force synchronous single-item polling loop instead of batching',
        rationale: 'Legacy partner bank gateway drops webhook payloads when batch size exceeds 1.'
    })
    CREATE (d2:Decision {
        id: 'dec_20',
        title: 'Migrate to V3 OAuth2 Token Exchange',
        status: 'ACCEPTED',
        summary: 'Deprecate v1 auth endpoint in favor of v3 OAuth tokens',
        rationale: 'V1 auth does not support RS256 JWT rotation.'
    })
    CREATE (d3:Decision {
        id: 'dec_21',
        title: 'Mandatory SHA-256 HMAC Signature on Bank Webhooks',
        status: 'ACCEPTED',
        summary: 'Mandate SHA-256 HMAC signature verification on all partner webhooks',
        rationale: 'Mitigate replay attacks identified in INC-8821.'
    })
    """
    client.query(decisions_cypher, tenant_id=tenant_id)

    # 9. Create 6 Jira Tickets
    jira_cypher = """
    CREATE (j1:JiraTicket {
        id: 'PAY-409',
        summary: 'Bank partner dropped webhook when batching charges',
        status: 'RESOLVED',
        priority: 'P0'
    })
    CREATE (j2:JiraTicket {
        id: 'PAY-512',
        summary: 'Implement exponential backoff in PaymentRetryWorker',
        status: 'CLOSED',
        priority: 'P1'
    })
    CREATE (j3:JiraTicket {
        id: 'AUTH-101',
        summary: 'Deprecate legacy v1 authentication endpoints',
        status: 'IN_PROGRESS',
        priority: 'P2'
    })
    CREATE (j4:JiraTicket {
        id: 'NOTIF-204',
        summary: 'Dead-letter queue alerting for notification failures',
        status: 'CLOSED',
        priority: 'P2'
    })
    CREATE (j5:JiraTicket {
        id: 'SEC-305',
        summary: 'Enforce SHA-256 HMAC signature validation on webhooks',
        status: 'CLOSED',
        priority: 'P1'
    })
    CREATE (j6:JiraTicket {
        id: 'INFRA-99',
        summary: 'Optimize FalkorDB memory limits and connection pool',
        status: 'CLOSED',
        priority: 'P2'
    })
    """
    client.query(jira_cypher, tenant_id=tenant_id)

    # 10. Create 8 VCS PR Comments
    vcs_cypher = """
    CREATE (c1:VCSComment {
        id: 'pr_882_c4',
        pr_number: 882,
        text: 'DO NOT upgrade to /v2/charge/batch here! Legacy partner bank gateway drops webhooks if batched > 1.'
    })
    CREATE (c2:VCSComment {
        id: 'pr_882_c1',
        pr_number: 882,
        text: 'Verified single-item retry loop passes partner sandbox tests.'
    })
    CREATE (c3:VCSComment {
        id: 'pr_910_c2',
        pr_number: 910,
        text: 'TokenIngestionWorker requires fallback to v3 OAuth endpoint if v1 410s.'
    })
    CREATE (c4:VCSComment {
        id: 'pr_740_c1',
        pr_number: 740,
        text: 'Idempotency keys must be UUID v4 stored in Redis.'
    })
    CREATE (c5:VCSComment {
        id: 'pr_650_c3',
        pr_number: 650,
        text: 'Notice: Partner gateway latency averages 350ms.'
    })
    CREATE (c6:VCSComment {
        id: 'pr_520_c1',
        pr_number: 520,
        text: 'Reviewed database connection pool tuning.'
    })
    CREATE (c7:VCSComment {
        id: 'pr_410_c5',
        pr_number: 410,
        text: 'Audit logging endpoint must be fire-and-forget.'
    })
    CREATE (c8:VCSComment {
        id: 'pr_330_c2',
        pr_number: 330,
        text: 'Notification dispatch timeout set to 2.5s.'
    })
    """
    client.query(vcs_cypher, tenant_id=tenant_id)

    # 11. Create 3 Guardrails
    guardrails_cypher = """
    CREATE (g1:Guardrail {
        id: 'GR-PAY-001',
        name: 'Legacy Partner Batching Invariant',
        module_name: 'PaymentRetryWorker',
        enforcement_level: 'BLOCK',
        description: 'Blocks batch upgrades to PaymentRetryWorker violating ADR dec_19.'
    })
    CREATE (g2:Guardrail {
        id: 'GR-AUTH-002',
        name: 'Legacy Auth Deprecation Guardrail',
        module_name: 'TokenIngestionWorker',
        enforcement_level: 'WARN',
        description: 'Enforces automated fallback to /v3/oauth/token when /v1/legacy-auth responds with HTTP 410.'
    })
    CREATE (g3:Guardrail {
        id: 'GR-SEC-003',
        name: 'Webhook Signature Enforcement',
        module_name: 'WebhookSignatureValidator',
        enforcement_level: 'BLOCK',
        description: 'Mandates SHA-256 HMAC verification on all incoming partner webhooks.'
    })
    """
    client.query(guardrails_cypher, tenant_id=tenant_id)

    # 12. Create 3 Production Incidents
    incidents_cypher = """
    CREATE (inc1:Incident {
        id: 'INC-8821',
        title: 'Double charge storm caused by batch webhook dropping',
        severity: 'SEV-1',
        financial_impact_usd: 185000.00
    })
    CREATE (inc2:Incident {
        id: 'INC-4412',
        title: 'Auth token expiration cascaded to settlement pipeline',
        severity: 'SEV-2',
        financial_impact_usd: 12000.00
    })
    CREATE (inc3:Incident {
        id: 'INC-2090',
        title: 'Notification buffer overflow during flash sale',
        severity: 'SEV-3',
        financial_impact_usd: 1500.00
    })
    """
    client.query(incidents_cypher, tenant_id=tenant_id)

    # ==============================================================================
    # RELATIONSHIPS & CANONICAL PATTERNS
    # ==============================================================================

    # Relationship Batch 1: Canonical 3-Hop Constraint Guardrail
    canonical_guardrail_cypher = """
    MATCH (mod:CodeModule {name: 'PaymentRetryWorker'})
    MATCH (dec:Decision {id: 'dec_19'})
    MATCH (jira:JiraTicket {id: 'PAY-409'})
    MATCH (vcs:VCSComment {id: 'pr_882_c4'})
    MATCH (eng:Engineer {name: 'Aarav'})
    MATCH (gr:Guardrail {id: 'GR-PAY-001'})
    MATCH (inc:Incident {id: 'INC-8821'})
    CREATE (mod)-[:IMPLEMENTS]->(dec)
    CREATE (dec)-[:FORCED_BY]->(jira)
    CREATE (jira)-[:EXPLAINED_IN]->(vcs)
    CREATE (eng)-[:AUTHORED]->(vcs)
    CREATE (gr)-[:PROTECTS]->(mod)
    CREATE (gr)-[:ENFORCES]->(dec)
    CREATE (dec)-[:MITIGATES]->(inc)
    """
    client.query(canonical_guardrail_cypher, tenant_id=tenant_id)

    # Relationship Batch 2: Canonical Self-Healing Procedural Workflow Topology
    self_healing_cypher = """
    MATCH (modAuth:CodeModule {name: 'TokenIngestionWorker'})
    MATCH (apiLegacy:APIEndpoint {name: '/v1/legacy-auth'})
    MATCH (apiAuthV3:APIEndpoint {name: '/v3/oauth/token'})
    MATCH (dec2:Decision {id: 'dec_20'})
    MATCH (gr2:Guardrail {id: 'GR-AUTH-002'})
    CREATE (modAuth)-[:EXECUTES_STEP {status: 'ACTIVE', weight: 1.0}]->(apiLegacy)
    CREATE (modAuth)-[:FALLBACK_STEP {status: 'STANDBY', weight: 0.5}]->(apiAuthV3)
    CREATE (apiLegacy)-[:SUPERSEDED_BY {confidence: 1.0}]->(apiAuthV3)
    CREATE (gr2)-[:PROTECTS]->(modAuth)
    CREATE (gr2)-[:ENFORCES]->(dec2)
    CREATE (dec2)-[:GOVERNS]->(apiAuthV3)
    """
    client.query(self_healing_cypher, tenant_id=tenant_id)

    # Relationship Batch 3: Service-Module-Endpoint Hierarchies
    hierarchy_cypher = """
    MATCH (sBilling:Service {id: 'svc_billing'})
    MATCH (sAuth:Service {id: 'svc_auth'})
    MATCH (sNotif:Service {id: 'svc_notif'})

    MATCH (m1:CodeModule {id: 'mod_payment_retry'})
    MATCH (m2:CodeModule {id: 'mod_token_ingest'})
    MATCH (m3:CodeModule {id: 'mod_webhook_sig'})
    MATCH (m4:CodeModule {id: 'mod_billing_ledger'})
    MATCH (m5:CodeModule {id: 'mod_notif_dispatch'})
    MATCH (m6:CodeModule {id: 'mod_audit_collector'})

    MATCH (e1:APIEndpoint {id: 'ep_legacy_auth'})
    MATCH (e2:APIEndpoint {id: 'ep_oauth_v3'})
    MATCH (e3:APIEndpoint {id: 'ep_charge_single'})
    MATCH (e4:APIEndpoint {id: 'ep_charge_batch'})
    MATCH (e5:APIEndpoint {id: 'ep_bank_webhook'})
    MATCH (e6:APIEndpoint {id: 'ep_refunds'})
    MATCH (e7:APIEndpoint {id: 'ep_notif_dispatch'})
    MATCH (e8:APIEndpoint {id: 'ep_audit_logs'})

    CREATE (sBilling)-[:CONTAINS]->(m1)
    CREATE (sBilling)-[:CONTAINS]->(m3)
    CREATE (sBilling)-[:CONTAINS]->(m4)
    CREATE (sAuth)-[:CONTAINS]->(m2)
    CREATE (sNotif)-[:CONTAINS]->(m5)
    CREATE (sBilling)-[:CONTAINS]->(m6)

    CREATE (sBilling)-[:DEPENDS_ON]->(sAuth)
    CREATE (sBilling)-[:DEPENDS_ON]->(sNotif)

    CREATE (m1)-[:CALLS]->(e3)
    CREATE (m3)-[:EXPOSES]->(e5)
    CREATE (m4)-[:CALLS]->(e6)
    CREATE (m5)-[:EXPOSES]->(e7)
    CREATE (m6)-[:EXPOSES]->(e8)
    """
    client.query(hierarchy_cypher, tenant_id=tenant_id)

    # Relationship Batch 4: Engineer Collaboration Network (PageRank Centrality)
    # Aarav is connected to multiple modules, decisions, tickets, comments, and peers
    collaboration_cypher = """
    MATCH (eng1:Engineer {name: 'Aarav'})
    MATCH (eng2:Engineer {name: 'Maya'})
    MATCH (eng3:Engineer {name: 'Liam'})
    MATCH (eng4:Engineer {name: 'Sophia'})

    MATCH (team1:Team {id: 'team_payments'})
    MATCH (team2:Team {id: 'team_platform'})
    MATCH (team3:Team {id: 'team_security'})

    MATCH (sBilling:Service {id: 'svc_billing'})
    MATCH (sAuth:Service {id: 'svc_auth'})
    MATCH (sNotif:Service {id: 'svc_notif'})

    MATCH (m1:CodeModule {id: 'mod_payment_retry'})
    MATCH (m3:CodeModule {id: 'mod_webhook_sig'})
    MATCH (m4:CodeModule {id: 'mod_billing_ledger'})

    MATCH (d1:Decision {id: 'dec_19'})
    MATCH (d2:Decision {id: 'dec_20'})
    MATCH (d3:Decision {id: 'dec_21'})

    MATCH (j1:JiraTicket {id: 'PAY-409'})
    MATCH (j2:JiraTicket {id: 'PAY-512'})
    MATCH (j3:JiraTicket {id: 'AUTH-101'})
    MATCH (j4:JiraTicket {id: 'NOTIF-204'})
    MATCH (j5:JiraTicket {id: 'SEC-305'})
    MATCH (j6:JiraTicket {id: 'INFRA-99'})

    MATCH (c2:VCSComment {id: 'pr_882_c1'})
    MATCH (c3:VCSComment {id: 'pr_910_c2'})
    MATCH (c4:VCSComment {id: 'pr_740_c1'})
    MATCH (c5:VCSComment {id: 'pr_650_c3'})
    MATCH (c6:VCSComment {id: 'pr_520_c1'})
    MATCH (c7:VCSComment {id: 'pr_410_c5'})
    MATCH (c8:VCSComment {id: 'pr_330_c2'})

    MATCH (inc1:Incident {id: 'INC-8821'})
    MATCH (inc2:Incident {id: 'INC-4412'})
    MATCH (inc3:Incident {id: 'INC-2090'})

    // Team memberships
    CREATE (eng1)-[:MEMBER_OF]->(team1)
    CREATE (eng3)-[:MEMBER_OF]->(team1)
    CREATE (eng2)-[:MEMBER_OF]->(team2)
    CREATE (eng4)-[:MEMBER_OF]->(team3)

    // Aarav (Lead Architect - high degree centrality)
    CREATE (eng1)-[:AUTHORED]->(d1)
    CREATE (eng1)-[:AUTHORED]->(d3)
    CREATE (eng1)-[:AUTHORED]->(c2)
    CREATE (eng1)-[:AUTHORED]->(c4)
    CREATE (eng1)-[:RESOLVED]->(j1)
    CREATE (eng1)-[:RESOLVED]->(j2)
    CREATE (eng1)-[:MAINTAINS]->(m1)
    CREATE (eng1)-[:MAINTAINS]->(m4)
    CREATE (eng1)-[:OWNS]->(sBilling)
    CREATE (eng1)-[:INVESTIGATED]->(inc1)
    CREATE (eng1)-[:COLLABORATES_WITH]->(eng2)
    CREATE (eng1)-[:COLLABORATES_WITH]->(eng3)
    CREATE (eng1)-[:COLLABORATES_WITH]->(eng4)

    // Liam (Billing backend)
    CREATE (eng3)-[:MAINTAINS]->(m3)
    CREATE (eng3)-[:CONTRIBUTED_TO]->(m1)
    CREATE (eng3)-[:AUTHORED]->(c5)
    CREATE (eng3)-[:RESOLVED]->(j5)

    // Maya (Reliability / Infra)
    CREATE (eng2)-[:OWNS]->(sNotif)
    CREATE (eng2)-[:RESOLVED]->(j4)
    CREATE (eng2)-[:RESOLVED]->(j6)
    CREATE (eng2)-[:AUTHORED]->(c6)
    CREATE (eng2)-[:AUTHORED]->(c8)
    CREATE (eng2)-[:INVESTIGATED]->(inc3)

    // Sophia (Security)
    CREATE (eng4)-[:OWNS]->(sAuth)
    CREATE (eng4)-[:AUTHORED]->(d2)
    CREATE (eng4)-[:AUTHORED]->(c3)
    CREATE (eng4)-[:AUTHORED]->(c7)
    CREATE (eng4)-[:RESOLVED]->(j3)
    CREATE (eng4)-[:INVESTIGATED]->(inc2)
    """
    client.query(collaboration_cypher, tenant_id=tenant_id)

    # 13. Summarize resulting topology
    node_res = client.query("MATCH (n) RETURN count(n) AS cnt", tenant_id=tenant_id)
    edge_res = client.query("MATCH ()-[r]->() RETURN count(r) AS cnt", tenant_id=tenant_id)

    node_count = node_res.records[0]["cnt"] if node_res.records else 0
    edge_count = edge_res.records[0]["cnt"] if edge_res.records else 0

    return {
        "status": "SUCCESS",
        "tenant_id": tenant_id,
        "node_count": node_count,
        "edge_count": edge_count,
    }
