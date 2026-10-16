"""
Active Engineering Memory Layer - Server-Sent Events (SSE) Models
==================================================================
This module defines the typed Pydantic models conforming to the contract
specified in /contracts/events.schema.json.

These models power the real-time SSE stream between the FastAPI backend
and the Next.js frontend, conveying:
1. Multi-agent chain-of-thought steps (AGENT_STEP)
2. FastMCP tool executions against FalkorDB (MCP_TOOL_CALL)
3. Live graph topology mutations (GRAPH_MUTATION)
4. Active engineering guardrail trips (GUARDRAIL_TRIGGERED)
5. Terminal session states and summaries (SESSION_COMPLETE)

Design Notes:
- Field defaults for `event_id` (UUID4) and `timestamp` (ISO UTC format)
  allow convenient instantiation while preserving strict validation.
- Pydantic v2 `TypeAdapter` and discriminated unions ensure O(1) polymorphic
  event parsing and type-narrowing across the SSE pipeline.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Dict, List, Literal, Optional, Union
import uuid

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator


def _utc_now_iso() -> str:
    """Generate ISO 8601 formatted UTC timestamp string with 'Z' suffix."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class EventBase(BaseModel):
    """
    Common header metadata for all Active Engineering Memory Layer SSE events.
    Includes unique tracking ID and RFC 3339 / ISO 8601 timestamp.
    """
    model_config = ConfigDict(extra="forbid", validate_assignment=True)

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Globally unique identifier for the event instance (UUID v4).",
    )
    timestamp: str = Field(
        default_factory=_utc_now_iso,
        description="ISO 8601 UTC timestamp when the event was produced.",
    )


class AgentStepEvent(EventBase):
    """
    Emitted when an agent (e.g. LangGraph worker or orchestrator) produces a
    reasoning thought and determines its next planned tool or action.
    """
    event_type: Literal["AGENT_STEP"] = Field(
        default="AGENT_STEP",
        description="Discriminator literal identifying agent reasoning steps.",
    )
    session_id: str = Field(
        ...,
        description="Active session trace identifier.",
    )
    agent_name: str = Field(
        ...,
        description="Name of the agent worker (e.g. 'RefactoringArchitectAgent').",
    )
    thought: str = Field(
        ...,
        description="Internal chain-of-thought rationale driving the next tool or action.",
    )
    action: str = Field(
        ...,
        description="The planned operation or execution target.",
    )


class McpToolCallEvent(EventBase):
    """
    Emitted when a FastMCP tool is invoked against the FalkorDB memory layer,
    graph traversal engine, or internal microservice mock gateways.
    """
    event_type: Literal["MCP_TOOL_CALL"] = Field(
        default="MCP_TOOL_CALL",
        description="Discriminator literal identifying FastMCP tool execution.",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Active session trace identifier (optional if tool is standalone).",
    )
    tool_name: str = Field(
        ...,
        description="Name of the FastMCP tool executed, e.g. 'query_decision_graph'.",
    )
    arguments: Dict[str, Any] = Field(
        default_factory=dict,
        description="Dictionary of parameters supplied to the tool.",
    )
    cypher_executed: Optional[str] = Field(
        default=None,
        description="Raw Cypher query string dispatched to FalkorDB, or null for non-graph tools.",
    )
    latency_ms: float = Field(
        ...,
        ge=0.0,
        description="Execution latency in milliseconds.",
    )


class GraphMutationType(str, Enum):
    """Permitted categories of graph mutations inside FalkorDB."""
    CREATE_NODE = "CREATE_NODE"
    UPDATE_NODE = "UPDATE_NODE"
    DELETE_NODE = "DELETE_NODE"
    MERGE_RELATIONSHIP = "MERGE_RELATIONSHIP"
    DELETE_RELATIONSHIP = "DELETE_RELATIONSHIP"
    BATCH_UPSERT = "BATCH_UPSERT"


class GraphMutationEvent(EventBase):
    """
    Emitted when FalkorDB graph state is mutated (nodes created, relationships
    updated, properties refreshed) to keep frontend graph visualizers synchronized.
    """
    event_type: Literal["GRAPH_MUTATION"] = Field(
        default="GRAPH_MUTATION",
        description="Discriminator literal identifying graph topology changes.",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Active session trace identifier.",
    )
    mutation_type: GraphMutationType = Field(
        ...,
        description="Category of graph mutation performed in FalkorDB.",
    )
    affected_nodes: List[str] = Field(
        default_factory=list,
        description="List of node labels or IDs affected by the mutation.",
    )
    affected_edges: List[str] = Field(
        default_factory=list,
        description="List of relationship types or edge IDs affected.",
    )
    summary: str = Field(
        ...,
        description="Human-readable summary of the graph mutation.",
    )

    @field_validator("mutation_type", mode="before")
    @classmethod
    def parse_mutation_type(cls, v: Any) -> GraphMutationType:
        if isinstance(v, GraphMutationType):
            return v
        if isinstance(v, str):
            try:
                return GraphMutationType(v)
            except ValueError:
                raise ValueError(f"Invalid mutation_type: '{v}'. Must be one of {[e.value for e in GraphMutationType]}")
        raise ValueError(f"Invalid mutation_type: {v}")


class GuardrailTriggeredEvent(EventBase):
    """
    Emitted when an active engineering guardrail blocks or flags an unsafe
    code alteration, deprecated API call, or architectural regression.
    Carries full socio-technical context: ADR, incident, Jira ticket, author.
    """
    event_type: Literal["GUARDRAIL_TRIGGERED"] = Field(
        default="GUARDRAIL_TRIGGERED",
        description="Discriminator literal identifying active guardrail interventions.",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Active session trace identifier.",
    )
    module_name: str = Field(
        ...,
        description="Target module or component that triggered the guardrail violation.",
    )
    decision_id: str = Field(
        ...,
        description="ID of the governing Architecture Decision Record (e.g. 'ADR-042').",
    )
    jira_ticket: str = Field(
        ...,
        description="Associated Jira ticket documenting the invariant or incident postmortem.",
    )
    vcs_comment: str = Field(
        ...,
        description="Historic code review warning or PR comment explaining the architectural rationale.",
    )
    engineer_owner: str = Field(
        ...,
        description="Lead engineer or architect who authored the decision.",
    )
    path_nodes: List[str] = Field(
        default_factory=list,
        description="Ordered node IDs tracing the FalkorDB traversal path proving the violation.",
    )


class SessionStatus(str, Enum):
    """Terminal state for an active engineering memory session."""
    SUCCESS = "SUCCESS"
    BLOCKED_BY_GUARDRAIL = "BLOCKED_BY_GUARDRAIL"
    FAILED = "FAILED"
    ABORTED = "ABORTED"


class SessionCompleteEvent(EventBase):
    """
    Emitted when an agent session reaches terminal completion.
    Provides summary of decisions safeguarded or changes committed.
    """
    event_type: Literal["SESSION_COMPLETE"] = Field(
        default="SESSION_COMPLETE",
        description="Discriminator literal identifying session completion.",
    )
    session_id: str = Field(
        ...,
        description="Active session trace identifier.",
    )
    status: SessionStatus = Field(
        ...,
        description="Terminal status of the session.",
    )
    final_summary: str = Field(
        ...,
        description="Comprehensive explanation of outcomes or mutations applied.",
    )

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> SessionStatus:
        if isinstance(v, SessionStatus):
            return v
        if isinstance(v, str):
            try:
                return SessionStatus(v)
            except ValueError:
                raise ValueError(f"Invalid session status: '{v}'. Must be one of {[s.value for s in SessionStatus]}")
        raise ValueError(f"Invalid session status: {v}")


# Discriminated union of all 5 event types
MemoryEventUnion = Annotated[
    Union[
        AgentStepEvent,
        McpToolCallEvent,
        GraphMutationEvent,
        GuardrailTriggeredEvent,
        SessionCompleteEvent,
    ],
    Field(discriminator="event_type"),
]

# TypeAdapter for efficient polymorphic deserialization
_EVENT_ADAPTER = TypeAdapter(MemoryEventUnion)


def parse_event(data: Union[dict, str]) -> MemoryEventUnion:
    """
    Parse a raw dictionary or JSON string into its strongly-typed event model
    using the 'event_type' discriminator field.

    Raises:
        pydantic.ValidationError if payload fails validation.
        ValueError if the payload cannot be parsed.
    """
    if isinstance(data, str):
        return _EVENT_ADAPTER.validate_json(data)
    elif isinstance(data, dict):
        return _EVENT_ADAPTER.validate_python(data)
    else:
        raise ValueError(f"Unsupported event data type: {type(data)}. Expected dict or str.")
