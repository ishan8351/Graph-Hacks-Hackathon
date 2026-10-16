import { describe, it, expect } from "vitest";
import {
  AgentStepEvent,
  McpToolCallEvent,
  GraphMutationEvent,
  GuardrailTriggeredEvent,
  SessionCompleteEvent,
  MemoryLayerEvent,
} from "../types/events";

describe("Frontend Event Contracts (Phase 0)", () => {
  it("correctly models AGENT_STEP event", () => {
    const event: AgentStepEvent = {
      event_id: "evt_1",
      timestamp: "2026-10-16T06:00:00Z",
      event_type: "AGENT_STEP",
      session_id: "sess_1",
      agent_name: "RefactoringArchitectAgent",
      thought: "Checking guardrail status",
      action: "query_decision_graph",
    };
    expect(event.event_type).toBe("AGENT_STEP");
    expect(event.thought).toBe("Checking guardrail status");
  });

  it("correctly models MCP_TOOL_CALL event", () => {
    const event: McpToolCallEvent = {
      event_id: "evt_2",
      timestamp: "2026-10-16T06:00:01Z",
      event_type: "MCP_TOOL_CALL",
      tool_name: "query_decision_graph",
      arguments: { module_name: "webhook_router" },
      cypher_executed: "MATCH (m:Module) RETURN m;",
      latency_ms: 12.4,
    };
    expect(event.event_type).toBe("MCP_TOOL_CALL");
    expect(event.latency_ms).toBeGreaterThan(0);
  });

  it("correctly models GRAPH_MUTATION event", () => {
    const event: GraphMutationEvent = {
      event_id: "evt_3",
      timestamp: "2026-10-16T06:00:02Z",
      event_type: "GRAPH_MUTATION",
      mutation_type: "MERGE_RELATIONSHIP",
      affected_nodes: ["ADR-042", "webhook_router"],
      affected_edges: ["GOVERNS"],
      summary: "Linked ADR to module",
    };
    expect(event.event_type).toBe("GRAPH_MUTATION");
    expect(event.affected_nodes.length).toBe(2);
  });

  it("correctly models GUARDRAIL_TRIGGERED event", () => {
    const event: GuardrailTriggeredEvent = {
      event_id: "evt_4",
      timestamp: "2026-10-16T06:00:03Z",
      event_type: "GUARDRAIL_TRIGGERED",
      module_name: "webhook_router",
      decision_id: "ADR-042",
      jira_ticket: "PAY-1049",
      vcs_comment: "DO NOT reintroduce synchronous bank webhook handlers without idempotency keys.",
      engineer_owner: "Sarah Chen",
      path_nodes: ["GR-PAY-001", "webhook_router", "ADR-042"],
    };
    expect(event.event_type).toBe("GUARDRAIL_TRIGGERED");
    expect(event.decision_id).toBe("ADR-042");
  });

  it("correctly models SESSION_COMPLETE event", () => {
    const event: SessionCompleteEvent = {
      event_id: "evt_5",
      timestamp: "2026-10-16T06:00:04Z",
      event_type: "SESSION_COMPLETE",
      session_id: "sess_1",
      status: "BLOCKED_BY_GUARDRAIL",
      final_summary: "Operation blocked by active guardrail.",
    };
    expect(event.event_type).toBe("SESSION_COMPLETE");
    expect(event.status).toBe("BLOCKED_BY_GUARDRAIL");
  });

  it("handles discriminated union narrowing cleanly", () => {
    const events: MemoryLayerEvent[] = [
      {
        event_id: "e1",
        timestamp: "2026-10-16T06:00:00Z",
        event_type: "AGENT_STEP",
        session_id: "s1",
        agent_name: "Agent",
        thought: "thought",
        action: "action",
      },
      {
        event_id: "e2",
        timestamp: "2026-10-16T06:00:01Z",
        event_type: "SESSION_COMPLETE",
        session_id: "s1",
        status: "SUCCESS",
        final_summary: "Done",
      },
    ];

    const types = events.map((e) => e.event_type);
    expect(types).toEqual(["AGENT_STEP", "SESSION_COMPLETE"]);
  });
});
