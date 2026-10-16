/**
 * Active Engineering Memory Layer - Frontend Event Type Definitions
 * Directly maps to /contracts/events.schema.json
 */

export type EventType =
  | "AGENT_STEP"
  | "MCP_TOOL_CALL"
  | "GRAPH_MUTATION"
  | "GUARDRAIL_TRIGGERED"
  | "SESSION_COMPLETE";

export interface BaseEvent {
  event_id: string;
  timestamp: string;
  session_id?: string;
}

export interface AgentStepEvent extends BaseEvent {
  event_type: "AGENT_STEP";
  session_id: string;
  agent_name: string;
  thought: string;
  action: string;
}

export interface McpToolCallEvent extends BaseEvent {
  event_type: "MCP_TOOL_CALL";
  tool_name: string;
  arguments: Record<string, unknown>;
  cypher_executed: string | null;
  latency_ms: number;
}

export type GraphMutationType =
  | "CREATE_NODE"
  | "UPDATE_NODE"
  | "DELETE_NODE"
  | "MERGE_RELATIONSHIP"
  | "DELETE_RELATIONSHIP"
  | "BATCH_UPSERT";

export interface GraphMutationEvent extends BaseEvent {
  event_type: "GRAPH_MUTATION";
  mutation_type: GraphMutationType;
  affected_nodes: string[];
  affected_edges: string[];
  summary: string;
}

export interface GuardrailTriggeredEvent extends BaseEvent {
  event_type: "GUARDRAIL_TRIGGERED";
  module_name: string;
  decision_id: string;
  jira_ticket: string;
  vcs_comment: string;
  engineer_owner: string;
  path_nodes: string[];
}

export type SessionStatus =
  | "SUCCESS"
  | "BLOCKED_BY_GUARDRAIL"
  | "FAILED"
  | "ABORTED";

export interface SessionCompleteEvent extends BaseEvent {
  event_type: "SESSION_COMPLETE";
  session_id: string;
  status: SessionStatus;
  final_summary: string;
}

export type MemoryLayerEvent =
  | AgentStepEvent
  | McpToolCallEvent
  | GraphMutationEvent
  | GuardrailTriggeredEvent
  | SessionCompleteEvent;
