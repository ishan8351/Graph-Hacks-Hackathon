"""
Contract Validation Test Suite (TDD Phase 0)
=============================================
Validates bi-directional compatibility between:
1. JSON Schema specification in /contracts/events.schema.json
2. Pydantic SSE event models in backend/app/models/events.py

Ensures all 5 event types strictly conform to defined schemas:
- AGENT_STEP
- MCP_TOOL_CALL
- GRAPH_MUTATION
- GUARDRAIL_TRIGGERED
- SESSION_COMPLETE
"""

import json
from pathlib import Path
import pytest
from jsonschema import validate, Draft7Validator
from jsonschema.exceptions import ValidationError as JsonSchemaValidationError
from pydantic import ValidationError

# Import Pydantic models from backend/app/models/events.py
from app.models.events import (
    AgentStepEvent,
    McpToolCallEvent,
    GraphMutationEvent,
    GuardrailTriggeredEvent,
    SessionCompleteEvent,
    MemoryEventUnion,
    parse_event,
)


@pytest.fixture(scope="session")
def event_schema() -> dict:
    """Load and verify the JSON Schema definition from /contracts/events.schema.json."""
    contracts_dir = Path(__file__).resolve().parents[2] / "contracts"
    schema_file = contracts_dir / "events.schema.json"
    assert schema_file.exists(), f"Schema file not found at {schema_file}"
    
    with open(schema_file, "r", encoding="utf-8") as f:
        schema = json.load(f)
    
    # Ensure schema itself is a valid Draft 7 JSON schema
    Draft7Validator.check_schema(schema)
    return schema


def test_schema_validity(event_schema: dict):
    """Confirm the JSON schema contract is valid Draft-7 schema and defines all required event types."""
    assert event_schema.get("title") == "ActiveEngineeringMemoryEventStream"
    assert "oneOf" in event_schema
    definitions = event_schema.get("definitions", {})
    expected_definitions = {
        "AgentStepEvent",
        "McpToolCallEvent",
        "GraphMutationEvent",
        "GuardrailTriggeredEvent",
        "SessionCompleteEvent",
    }
    for def_name in expected_definitions:
        assert def_name in definitions, f"Missing definition {def_name} in schema"


def test_memory_event_union_type():
    """Verify MemoryEventUnion type alias is defined and exported for polymorphic event handling."""
    assert MemoryEventUnion is not None


def test_agent_step_event_valid(event_schema: dict):
    """Validate that AGENT_STEP serializes and validates cleanly against JSON schema and Pydantic."""
    event = AgentStepEvent(
        event_id="d8b74c52-7e04-4c8d-9051-70bf8f081491",
        timestamp="2026-10-16T06:05:00Z",
        agent_name="RefactoringArchitectAgent",
        session_id="sess_live_9941a",
        thought="Inspecting webhook_router dependencies before proposing fallback to legacy bank endpoint.",
        action="Query FalkorDB decision graph for ADRs governing webhook_router",
    )
    payload = event.model_dump(mode="json")
    
    # Validate against JSON Schema
    validate(instance=payload, schema=event_schema)
    assert payload["event_type"] == "AGENT_STEP"
    assert payload["agent_name"] == "RefactoringArchitectAgent"

    # Validate parsing back into Pydantic model
    parsed = parse_event(payload)
    assert isinstance(parsed, AgentStepEvent)
    assert parsed.event_id == event.event_id


def test_mcp_tool_call_event_valid(event_schema: dict):
    """Validate that MCP_TOOL_CALL serializes and validates cleanly against JSON schema and Pydantic."""
    event = McpToolCallEvent(
        event_id="e2b58c73-45a1-4091-bb21-118833990022",
        timestamp="2026-10-16T06:05:01Z",
        session_id="sess_live_9941a",
        tool_name="query_decision_graph",
        arguments={"module_name": "webhook_router", "depth": 2},
        cypher_executed="MATCH (m:Module {name: 'webhook_router'})<-[:GOVERNS]-(d:Decision) RETURN d;",
        latency_ms=14.82,
    )
    payload = event.model_dump(mode="json")
    
    validate(instance=payload, schema=event_schema)
    assert payload["event_type"] == "MCP_TOOL_CALL"
    assert payload["tool_name"] == "query_decision_graph"
    assert payload["latency_ms"] == 14.82

    parsed = parse_event(payload)
    assert isinstance(parsed, McpToolCallEvent)
    assert parsed.latency_ms == 14.82


def test_mcp_tool_call_event_null_cypher(event_schema: dict):
    """Validate MCP_TOOL_CALL allows cypher_executed to be None when calling non-graph tools."""
    event = McpToolCallEvent(
        event_id="e2b58c73-45a1-4091-bb21-118833990023",
        timestamp="2026-10-16T06:05:01Z",
        session_id="sess_live_9941a",
        tool_name="fake_microservice_gateway_ping",
        arguments={"endpoint": "/healthz"},
        cypher_executed=None,
        latency_ms=2.1,
    )
    payload = event.model_dump(mode="json")
    validate(instance=payload, schema=event_schema)
    parsed = parse_event(payload)
    assert isinstance(parsed, McpToolCallEvent)
    assert parsed.cypher_executed is None


def test_graph_mutation_event_valid(event_schema: dict):
    """Validate that GRAPH_MUTATION serializes and validates cleanly against JSON schema and Pydantic."""
    event = GraphMutationEvent(
        event_id="a1122334-4455-6677-8899-aabbccddeeff",
        timestamp="2026-10-16T06:05:02Z",
        session_id="sess_live_9941a",
        mutation_type="MERGE_RELATIONSHIP",
        affected_nodes=["mod_payment_gateway_webhook_router", "ADR-042"],
        affected_edges=["GOVERNS"],
        summary="Linked ADR-042 to webhook_router to enforce idempotent webhook requirements.",
    )
    payload = event.model_dump(mode="json")
    
    validate(instance=payload, schema=event_schema)
    assert payload["event_type"] == "GRAPH_MUTATION"
    assert payload["mutation_type"] == "MERGE_RELATIONSHIP"
    assert len(payload["affected_nodes"]) == 2

    parsed = parse_event(payload)
    assert isinstance(parsed, GraphMutationEvent)
    assert parsed.mutation_type == "MERGE_RELATIONSHIP"


def test_guardrail_triggered_event_valid(event_schema: dict):
    """Validate that GUARDRAIL_TRIGGERED serializes and validates cleanly against JSON schema and Pydantic."""
    event = GuardrailTriggeredEvent(
        event_id="f9988776-5544-3322-1100-ffeeddccbbaa",
        timestamp="2026-10-16T06:05:03Z",
        session_id="sess_live_9941a",
        module_name="webhook_router",
        decision_id="ADR-042",
        jira_ticket="PAY-1049",
        vcs_comment="DO NOT reintroduce synchronous bank webhook handlers without idempotency keys. See ADR-042.",
        engineer_owner="Sarah Chen",
        path_nodes=["GR-PAY-001", "webhook_router", "ADR-042", "INC-8821", "PAY-1049"],
    )
    payload = event.model_dump(mode="json")
    
    validate(instance=payload, schema=event_schema)
    assert payload["event_type"] == "GUARDRAIL_TRIGGERED"
    assert payload["decision_id"] == "ADR-042"
    assert payload["engineer_owner"] == "Sarah Chen"

    parsed = parse_event(payload)
    assert isinstance(parsed, GuardrailTriggeredEvent)
    assert parsed.decision_id == "ADR-042"


def test_session_complete_event_valid(event_schema: dict):
    """Validate that SESSION_COMPLETE serializes and validates cleanly against JSON schema and Pydantic."""
    event = SessionCompleteEvent(
        event_id="b0011223-3445-5667-7889-9aabbccddeef",
        timestamp="2026-10-16T06:05:04Z",
        session_id="sess_live_9941a",
        status="BLOCKED_BY_GUARDRAIL",
        final_summary="Agent attempt to enable v1 webhook polling was blocked by Active Engineering Guardrail GR-PAY-001 enforcing ADR-042.",
    )
    payload = event.model_dump(mode="json")
    
    validate(instance=payload, schema=event_schema)
    assert payload["event_type"] == "SESSION_COMPLETE"
    assert payload["status"] == "BLOCKED_BY_GUARDRAIL"

    parsed = parse_event(payload)
    assert isinstance(parsed, SessionCompleteEvent)
    assert parsed.status == "BLOCKED_BY_GUARDRAIL"


def test_invalid_payload_fails_validation(event_schema: dict):
    """Ensure invalid payloads missing mandatory fields or invalid event_type fail schema validation."""
    invalid_agent_step = {
        "event_id": "test-id",
        "timestamp": "2026-10-16T06:05:00Z",
        "event_type": "AGENT_STEP",
        # missing agent_name, session_id, thought, action
    }
    with pytest.raises(JsonSchemaValidationError):
        validate(instance=invalid_agent_step, schema=event_schema)

    with pytest.raises(ValidationError):
        AgentStepEvent.model_validate(invalid_agent_step)


def test_invalid_event_type_rejected(event_schema: dict):
    """Ensure unknown event types cannot be parsed or validated."""
    invalid_event = {
        "event_id": "test-id",
        "timestamp": "2026-10-16T06:05:00Z",
        "event_type": "UNKNOWN_EVENT_TYPE",
        "data": {},
    }
    with pytest.raises(JsonSchemaValidationError):
        validate(instance=invalid_event, schema=event_schema)

    with pytest.raises(ValueError):
        parse_event(invalid_event)
