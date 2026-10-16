"""
Active Engineering Memory Layer - LangGraph Multi-Agent Swarm
=============================================================
Orchestrates multi-agent engineering workflows with dual-mode deterministic reasoning,
real FalkorDB graph traversals, and FastMCP tool executions.

Core Scenarios Implemented:
1. Scenario A Session 1 (IngestionSubagent):
   Discovers HTTP 410 on /v1/legacy-auth, applies atomic Graph Stigmergy,
   persists failure episode, and heals execution route to /v3/oauth/token.
2. Scenario A Session 2 (BillingSubagent):
   A new agent in a fresh session zero-shots /v3/oauth/token by inheriting
   the stigmergic failure provenance from Session 1.
3. Scenario B (ArchitectAgent):
   Inspects PaymentRetryWorker for batch optimization, traverses the 3-hop
   guardrail (ADR dec_19 -> PAY-409 -> pr_882_c4 <- Aarav), emits GUARDRAIL_TRIGGERED,
   and safely halts the destructive refactor.
"""

from typing import Any, Callable, Dict, List, Optional, TypedDict
import uuid

from langgraph.graph import StateGraph, START, END

from app.db.graph_client import FalkorDBClient
from app.mcp.memory_mcp import MemoryContextController
from app.models.events import (
    AgentStepEvent,
    McpToolCallEvent,
    GraphMutationEvent,
    GuardrailTriggeredEvent,
    SessionCompleteEvent,
    SessionStatus,
)
from app.services.fake_api_gateway import FakeMicroserviceGateway, DeprecatedAPIError

# Optional callback type for real-time SSE streaming
EventListener = Callable[[Any], None]


class SwarmState(TypedDict):
    """
    Typed state container passed between LangGraph agent nodes.
    """
    session_id: str
    scenario_type: str
    tenant_id: str
    target_module: str
    messages: List[Dict[str, Any]]
    events_emitted: List[Any]
    active_endpoint: Optional[str]
    guardrail_halted: bool
    final_outcome: Optional[str]


def _emit_event(state: SwarmState, event: Any, listener: Optional[EventListener] = None) -> None:
    """Helper to record an event in SwarmState and notify the real-time SSE listener."""
    state["events_emitted"].append(event)
    if listener:
        listener(event)


# ==============================================================================
# Scenario A Nodes: Stigmergy & Self-Healing Loop
# ==============================================================================

def scenario_a_s1_investigate(
    state: SwarmState,
    controller: MemoryContextController,
    listener: Optional[EventListener] = None,
) -> SwarmState:
    """Session 1: IngestionSubagent queries procedural route for TokenIngestionWorker."""
    step_evt = AgentStepEvent(
        session_id=state["session_id"],
        agent_name="IngestionSubagent",
        thought="Querying procedural route for TokenIngestionWorker to establish active API endpoint...",
        action="get_procedural_route('TokenIngestionWorker')",
    )
    _emit_event(state, step_evt, listener)

    route_res = controller.get_procedural_route(
        module_name=state["target_module"],
        tenant_id=state["tenant_id"],
    )

    tool_evt = McpToolCallEvent(
        session_id=state["session_id"],
        tool_name="get_procedural_route",
        arguments={"module_name": state["target_module"], "tenant_id": state["tenant_id"]},
        cypher_executed=route_res.get("cypher_executed"),
        latency_ms=11.5,
    )
    _emit_event(state, tool_evt, listener)

    state["active_endpoint"] = route_res.get("active_endpoint")
    return state


def scenario_a_s1_execute_and_heal(
    state: SwarmState,
    controller: MemoryContextController,
    gateway: FakeMicroserviceGateway,
    listener: Optional[EventListener] = None,
) -> SwarmState:
    """Session 1: Attempt call on /v1/legacy-auth, catch 410, and execute Graph Stigmergy."""
    endpoint = state["active_endpoint"] or "/v1/legacy-auth"

    try:
        call_res = gateway.call(endpoint, method="POST")
        step_succ_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="IngestionSubagent",
            thought=f"Endpoint '{endpoint}' is active and operational. Call succeeded with status {call_res.get('status', 200)}.",
            action="finalize_successful_execution",
        )
        _emit_event(state, step_succ_evt, listener)
        state["final_outcome"] = "SUCCESS"
    except DeprecatedAPIError as exc:
        step_err_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="IngestionSubagent",
            thought=(
                f"Operational failure encountered: {exc.error_code} ({exc.message}). "
                f"Recommended replacement is '{exc.recommended_replacement}'. "
                "Triggering Graph Stigmergy to heal graph memory and deprecate failed route."
            ),
            action=f"log_failed_task({endpoint} -> {exc.recommended_replacement})",
        )
        _emit_event(state, step_err_evt, listener)

        # Atomic Graph Stigmergy mutation
        mutation = controller.log_failed_task(
            agent_name="IngestionSubagent",
            session_id=state["session_id"],
            module_name=state["target_module"],
            failed_endpoint=endpoint,
            error_message=str(exc),
            replacement_endpoint=exc.recommended_replacement,
            tenant_id=state["tenant_id"],
        )

        tool_mut_evt = McpToolCallEvent(
            session_id=state["session_id"],
            tool_name="log_failed_task",
            arguments={
                "failed_endpoint": endpoint,
                "replacement_endpoint": exc.recommended_replacement,
                "module_name": state["target_module"],
            },
            cypher_executed=mutation.get("cypher_executed"),
            latency_ms=17.2,
        )
        _emit_event(state, tool_mut_evt, listener)

        graph_mut_evt = GraphMutationEvent(
            session_id=state["session_id"],
            mutation_type="MERGE_RELATIONSHIP",
            affected_nodes=mutation.get("affected_nodes", []),
            affected_edges=mutation.get("affected_edges", []),
            summary=mutation.get("summary", "Graph Stigmergy: Deprecated failed route and healed active step."),
        )
        _emit_event(state, graph_mut_evt, listener)

        # Retry with replacement endpoint
        state["active_endpoint"] = exc.recommended_replacement
        try:
            retry_res = gateway.call(state["active_endpoint"], method="POST")
            step_retry_evt = AgentStepEvent(
                session_id=state["session_id"],
                agent_name="IngestionSubagent",
                thought=f"Retrying operational step on self-healed endpoint '{state['active_endpoint']}'. Call succeeded with status {retry_res.get('status', 200)}.",
                action="finalize_successful_execution",
            )
            _emit_event(state, step_retry_evt, listener)
            state["final_outcome"] = "SUCCESS"
        except Exception as retry_exc:
            step_fail_evt = AgentStepEvent(
                session_id=state["session_id"],
                agent_name="IngestionSubagent",
                thought=f"Retry failed on self-healed endpoint '{state['active_endpoint']}': {retry_exc}",
                action="fail_execution",
            )
            _emit_event(state, step_fail_evt, listener)
            state["final_outcome"] = "FAILED"
    except Exception as exc:
        step_fail_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="IngestionSubagent",
            thought=f"Unexpected error executing {endpoint}: {exc}",
            action="fail_execution",
        )
        _emit_event(state, step_fail_evt, listener)
        state["final_outcome"] = "FAILED"

    return state


def scenario_a_s2_zero_shot_resolution(
    state: SwarmState,
    controller: MemoryContextController,
    gateway: FakeMicroserviceGateway,
    listener: Optional[EventListener] = None,
) -> SwarmState:
    """Session 2: BillingSubagent runs in fresh session and inherits Stigmergy knowledge."""
    step_evt = AgentStepEvent(
        session_id=state["session_id"],
        agent_name="BillingSubagent",
        thought="Querying procedural route for TokenIngestionWorker in Session 2...",
        action="get_procedural_route('TokenIngestionWorker')",
    )
    _emit_event(state, step_evt, listener)

    route_res = controller.get_procedural_route(
        module_name=state["target_module"],
        tenant_id=state["tenant_id"],
    )

    tool_evt = McpToolCallEvent(
        session_id=state["session_id"],
        tool_name="get_procedural_route",
        arguments={"module_name": state["target_module"], "tenant_id": state["tenant_id"]},
        cypher_executed=route_res.get("cypher_executed"),
        latency_ms=6.8,
    )
    _emit_event(state, tool_evt, listener)

    active_ep = route_res.get("active_endpoint")
    state["active_endpoint"] = active_ep

    if not active_ep:
        step_fail_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="BillingSubagent",
            thought=(
                f"FalkorDB procedural traversal found no operational route registered for module '{state['target_module']}'. "
                "Execution aborted. Please reset and seed graph first."
            ),
            action="abort_unresolved_route",
        )
        _emit_event(state, step_fail_evt, listener)
        state["final_outcome"] = "FAILED"
        return state

    if route_res.get("route_type") == "SELF_HEALED":
        thought = (
            f"FalkorDB procedural traversal detected previous failure episode. "
            f"Route automatically self-healed to '{active_ep}' with zero trial and error. "
            "Executing operational call."
        )
    else:
        thought = (
            f"FalkorDB procedural traversal returned route '{active_ep}' "
            f"(route_type: {route_res.get('route_type', 'UNKNOWN')}). Executing operational call."
        )

    step_exec_evt = AgentStepEvent(
        session_id=state["session_id"],
        agent_name="BillingSubagent",
        thought=thought,
        action=f"call({active_ep})",
    )
    _emit_event(state, step_exec_evt, listener)

    endpoint_to_call = active_ep
    try:
        call_res = gateway.call(endpoint_to_call, method="POST")
        state["final_outcome"] = "SUCCESS"
        step_succ_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="BillingSubagent",
            thought=f"Zero-shot call to {endpoint_to_call} completed successfully (token: {call_res.get('token', '')[:12]}...).",
            action="finalize_execution",
        )
        _emit_event(state, step_succ_evt, listener)
    except DeprecatedAPIError as exc:
        step_fail_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="BillingSubagent",
            thought=(
                f"Execution failed on '{endpoint_to_call}': {exc.error_code}. "
                "Notice: Route has not been self-healed by Session 1 yet. Run Act 1 Session 1 first to trigger Graph Stigmergy."
            ),
            action="fail_unhealed_route",
        )
        _emit_event(state, step_fail_evt, listener)
        state["final_outcome"] = "FAILED"
    except Exception as exc:
        step_fail_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="BillingSubagent",
            thought=f"Execution error on route {endpoint_to_call}: {exc}",
            action="fail_execution",
        )
        _emit_event(state, step_fail_evt, listener)
        state["final_outcome"] = "FAILED"

    return state


# ==============================================================================
# Scenario B Nodes: 3-Hop Constraint Guardrail
# ==============================================================================

def scenario_b_guardrail_check(
    state: SwarmState,
    controller: MemoryContextController,
    listener: Optional[EventListener] = None,
) -> SwarmState:
    """Scenario B: ArchitectAgent inspects PaymentRetryWorker and halts batch refactor."""
    step_init_evt = AgentStepEvent(
        session_id=state["session_id"],
        agent_name="ArchitectAgent",
        thought=(
            "User requested: 'Optimize the slow 450ms synchronous polling loop in PaymentRetryWorker "
            "by upgrading to /v2/charge/batch.' Checking Active Engineering Memory Layer for governing ADRs and constraints..."
        ),
        action="trace_design_decision('PaymentRetryWorker')",
    )
    _emit_event(state, step_init_evt, listener)

    decision_trace = controller.trace_design_decision(
        module_name=state["target_module"],
        tenant_id=state["tenant_id"],
    )

    tool_trace_evt = McpToolCallEvent(
        session_id=state["session_id"],
        tool_name="trace_design_decision",
        arguments={"module_name": state["target_module"], "tenant_id": state["tenant_id"]},
        cypher_executed=decision_trace.get("cypher_executed"),
        latency_ms=14.1,
    )
    _emit_event(state, tool_trace_evt, listener)

    # Centrality traversal to find lead architect
    expert_info = controller.find_domain_expert(
        module_name=state["target_module"],
        tenant_id=state["tenant_id"],
    )

    tool_expert_evt = McpToolCallEvent(
        session_id=state["session_id"],
        tool_name="find_domain_expert",
        arguments={"module_name": state["target_module"], "tenant_id": state["tenant_id"]},
        cypher_executed=expert_info.get("cypher_executed"),
        latency_ms=8.5,
    )
    _emit_event(state, tool_expert_evt, listener)

    if decision_trace.get("guardrail_active"):
        state["guardrail_halted"] = True
        state["final_outcome"] = "BLOCKED_BY_GUARDRAIL"

        dec_id = (decision_trace.get("decision") or {}).get("id") or "ADR-UNKNOWN"
        jira_id = (decision_trace.get("jira_ticket") or {}).get("id") or "JIRA-UNKNOWN"
        vcs_text = (decision_trace.get("vcs_comment") or {}).get("text") or "Refactor invariant active."
        owner_name = (decision_trace.get("engineer") or {}).get("name") or "Architect"
        path = decision_trace.get("path_nodes", [])

        gr_evt = GuardrailTriggeredEvent(
            session_id=state["session_id"],
            module_name=state["target_module"],
            decision_id=dec_id,
            jira_ticket=jira_id,
            vcs_comment=vcs_text,
            engineer_owner=owner_name,
            path_nodes=path,
        )
        _emit_event(state, gr_evt, listener)

        step_halt_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="ArchitectAgent",
            thought=(
                f"Active Engineering Guardrail Triggered! Traversed 3-hop invariant path: "
                f"PaymentRetryWorker -> {dec_id} (SUBOPTIMAL_WORKAROUND) -> {jira_id} -> {owner_name}. "
                f"VCS Warning: '{vcs_text}'. Upgrading to batch API would cause partner webhook drop outage. "
                "Refactor ABORTED. Preserving single-item polling loop."
            ),
            action="abort_destructive_refactor",
        )
        _emit_event(state, step_halt_evt, listener)
    else:
        state["guardrail_halted"] = False
        state["final_outcome"] = "SUCCESS"
        step_pass_evt = AgentStepEvent(
            session_id=state["session_id"],
            agent_name="ArchitectAgent",
            thought=(
                f"No active engineering guardrails found blocking refactor for module '{state['target_module']}'. "
                "Optimization may proceed safely."
            ),
            action="allow_refactor",
        )
        _emit_event(state, step_pass_evt, listener)

    return state


def complete_session_node(
    state: SwarmState,
    listener: Optional[EventListener] = None,
) -> SwarmState:
    """Final terminal node emitting SESSION_COMPLETE event."""
    outcome_raw = state.get("final_outcome")
    if not outcome_raw:
        if state.get("guardrail_halted"):
            outcome_raw = "BLOCKED_BY_GUARDRAIL"
        else:
            outcome_raw = "SUCCESS"

    if isinstance(outcome_raw, SessionStatus):
        outcome = outcome_raw
    else:
        try:
            outcome = SessionStatus(outcome_raw)
        except (ValueError, TypeError):
            outcome = SessionStatus.SUCCESS

    state["final_outcome"] = outcome.value

    if outcome == SessionStatus.BLOCKED_BY_GUARDRAIL:
        summary = (
            "Refactor blocked by Active Engineering Guardrail. PaymentRetryWorker is governed by ADR dec_19 "
            "(SUBOPTIMAL_WORKAROUND) authored by Aarav for incident postmortem PAY-409. Synchronous single-item "
            "charge processing preserved to prevent webhook drop outage."
        )
    elif outcome == SessionStatus.FAILED:
        summary = (
            f"Multi-agent swarm execution halted due to failure on module {state.get('target_module', 'Unknown')} "
            f"on route {state.get('active_endpoint', 'None')}."
        )
    else:
        summary = (
            f"Multi-agent swarm execution completed successfully. Module {state['target_module']} "
            f"operational on active route {state.get('active_endpoint')}."
        )

    term_evt = SessionCompleteEvent(
        session_id=state["session_id"],
        status=outcome,
        final_summary=summary,
    )
    _emit_event(state, term_evt, listener)
    return state


# ==============================================================================
# LangGraph Workflow Construction
# ==============================================================================

def build_swarm_graph(
    controller: Optional[MemoryContextController] = None,
    gateway: Optional[FakeMicroserviceGateway] = None,
    listener: Optional[EventListener] = None,
) -> Any:
    """
    Construct and compile the unified LangGraph multi-agent swarm state machine.
    """
    ctrl = controller or MemoryContextController()
    gw = gateway or FakeMicroserviceGateway()

    workflow = StateGraph(SwarmState)

    # Node wrappers injecting dependencies
    def node_s1_investigate(s: SwarmState) -> SwarmState:
        return scenario_a_s1_investigate(s, ctrl, listener)

    def node_s1_execute(s: SwarmState) -> SwarmState:
        return scenario_a_s1_execute_and_heal(s, ctrl, gw, listener)

    def node_s2_execute(s: SwarmState) -> SwarmState:
        return scenario_a_s2_zero_shot_resolution(s, ctrl, gw, listener)

    def node_b_guardrail(s: SwarmState) -> SwarmState:
        return scenario_b_guardrail_check(s, ctrl, listener)

    def node_complete(s: SwarmState) -> SwarmState:
        return complete_session_node(s, listener)

    workflow.add_node("scenario_a_s1_investigate", node_s1_investigate)
    workflow.add_node("scenario_a_s1_execute", node_s1_execute)
    workflow.add_node("scenario_a_s2_execute", node_s2_execute)
    workflow.add_node("scenario_b_guardrail", node_b_guardrail)
    workflow.add_node("complete_session", node_complete)

    # Scenario router from START
    def route_scenario(s: SwarmState) -> str:
        scen = s.get("scenario_type")
        if scen == "scenario_a_session_1":
            return "scenario_a_s1_investigate"
        elif scen == "scenario_a_session_2":
            return "scenario_a_s2_execute"
        elif scen == "scenario_b":
            return "scenario_b_guardrail"
        raise ValueError(f"Unknown scenario_type: {scen}")

    workflow.add_conditional_edges(
        START,
        route_scenario,
        {
            "scenario_a_s1_investigate": "scenario_a_s1_investigate",
            "scenario_a_s2_execute": "scenario_a_s2_execute",
            "scenario_b_guardrail": "scenario_b_guardrail",
        },
    )

    workflow.add_edge("scenario_a_s1_investigate", "scenario_a_s1_execute")
    workflow.add_edge("scenario_a_s1_execute", "complete_session")
    workflow.add_edge("scenario_a_s2_execute", "complete_session")
    workflow.add_edge("scenario_b_guardrail", "complete_session")
    workflow.add_edge("complete_session", END)

    return workflow.compile()


# ==============================================================================
# Public Runner Functions
# ==============================================================================

def run_scenario_a_session_1(
    tenant_id: str = "active_memory_default",
    session_id: Optional[str] = None,
    listener: Optional[EventListener] = None,
    client: Optional[FalkorDBClient] = None,
) -> SwarmState:
    """Run Scenario A Session 1: IngestionSubagent discovers 410 and triggers Graph Stigmergy."""
    sid = session_id or f"sess_s1_{uuid.uuid4().hex[:8]}"
    initial_state: SwarmState = {
        "session_id": sid,
        "scenario_type": "scenario_a_session_1",
        "tenant_id": tenant_id,
        "target_module": "TokenIngestionWorker",
        "messages": [],
        "events_emitted": [],
        "active_endpoint": None,
        "guardrail_halted": False,
        "final_outcome": None,
    }
    controller = MemoryContextController(client=client)
    app = build_swarm_graph(controller=controller, listener=listener)
    return app.invoke(initial_state)


def run_scenario_a_session_2(
    tenant_id: str = "active_memory_default",
    session_id: Optional[str] = None,
    listener: Optional[EventListener] = None,
    client: Optional[FalkorDBClient] = None,
) -> SwarmState:
    """Run Scenario A Session 2: BillingSubagent inherits Stigmergy route zero-shot."""
    sid = session_id or f"sess_s2_{uuid.uuid4().hex[:8]}"
    initial_state: SwarmState = {
        "session_id": sid,
        "scenario_type": "scenario_a_session_2",
        "tenant_id": tenant_id,
        "target_module": "TokenIngestionWorker",
        "messages": [],
        "events_emitted": [],
        "active_endpoint": None,
        "guardrail_halted": False,
        "final_outcome": None,
    }
    controller = MemoryContextController(client=client)
    app = build_swarm_graph(controller=controller, listener=listener)
    return app.invoke(initial_state)


def run_scenario_b_refactor_guardrail(
    tenant_id: str = "active_memory_default",
    session_id: Optional[str] = None,
    listener: Optional[EventListener] = None,
    client: Optional[FalkorDBClient] = None,
) -> SwarmState:
    """Run Scenario B: 3-Hop constraint guardrail halts dangerous batch refactor."""
    sid = session_id or f"sess_b_{uuid.uuid4().hex[:8]}"
    initial_state: SwarmState = {
        "session_id": sid,
        "scenario_type": "scenario_b",
        "tenant_id": tenant_id,
        "target_module": "PaymentRetryWorker",
        "messages": [
            {
                "role": "user",
                "content": "Optimize the slow 450ms synchronous polling loop in PaymentRetryWorker by upgrading to /v2/charge/batch.",
            }
        ],
        "events_emitted": [],
        "active_endpoint": "/v1/charge/sync",
        "guardrail_halted": False,
        "final_outcome": None,
    }
    controller = MemoryContextController(client=client)
    app = build_swarm_graph(controller=controller, listener=listener)
    return app.invoke(initial_state)
