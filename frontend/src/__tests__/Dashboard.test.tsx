import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Dashboard from "../components/Dashboard";

// Sample Graph State Fixture
const mockGraphState = {
  tenant_id: "tenant_project_alpha",
  nodes: [
    {
      id: "PaymentRetryWorker",
      label: "CodeModule",
      labels: ["CodeModule"],
      properties: { name: "PaymentRetryWorker", file_path: "billing/workers/retry.py" },
    },
    {
      id: "dec_19",
      label: "Decision",
      labels: ["Decision"],
      properties: { id: "dec_19", title: "ADR-019", status: "SUBOPTIMAL_WORKAROUND", summary: "Single polling" },
    },
    {
      id: "PAY-409",
      label: "JiraTicket",
      labels: ["JiraTicket"],
      properties: { id: "PAY-409", summary: "Bank partner dropped webhook" },
    },
    {
      id: "pr_882_c4",
      label: "VCSComment",
      labels: ["VCSComment"],
      properties: { id: "pr_882_c4", text: "DO NOT upgrade to /v2/charge/batch here! Legacy partner bank gateway drops webhooks if batched > 1." },
    },
    {
      id: "Aarav",
      label: "Engineer",
      labels: ["Engineer"],
      properties: { name: "Aarav", role: "Staff Systems Architect", email: "aarav@enterprise.internal" },
    },
    {
      id: "/v1/legacy-auth",
      label: "APIEndpoint",
      labels: ["APIEndpoint"],
      properties: { name: "/v1/legacy-auth", status: "ACTIVE" },
    },
    {
      id: "/v3/oauth/token",
      label: "APIEndpoint",
      labels: ["APIEndpoint"],
      properties: { name: "/v3/oauth/token", status: "ACTIVE" },
    },
  ],
  links: [
    {
      id: "link_1",
      source: "PaymentRetryWorker",
      target: "dec_19",
      type: "IMPLEMENTS",
      properties: {},
    },
    {
      id: "link_2",
      source: "dec_19",
      target: "PAY-409",
      type: "FORCED_BY",
      properties: {},
    },
    {
      id: "link_3",
      source: "PAY-409",
      target: "pr_882_c4",
      type: "EXPLAINED_IN",
      properties: {},
    },
    {
      id: "link_4",
      source: "Aarav",
      target: "pr_882_c4",
      type: "AUTHORED",
      properties: {},
    },
    {
      id: "link_5",
      source: "PaymentRetryWorker",
      target: "/v1/legacy-auth",
      type: "EXECUTES_STEP",
      properties: { status: "ACTIVE", weight: 1.0 },
    },
  ],
  stats: {
    active_endpoints: 6,
    deprecated_endpoints: 1,
    logged_episodes: 0,
    total_nodes: 7,
    total_links: 5,
  },
};

// Mock EventSource implementation for Vitest
class MockEventSource {
  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};
  static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: { data: string }) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  close() {}

  emit(data: Record<string, unknown>) {
    const payload = { data: JSON.stringify(data) };
    const eventType = data.event_type as string;
    if (eventType && this.listeners[eventType] && this.listeners[eventType].length > 0) {
      this.listeners[eventType].forEach((listener) => listener(payload));
    } else if (this.onmessage) {
      this.onmessage(payload);
    }
  }
}

describe("Dashboard Visual Explainability Component (Phase 5 TDD)", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);

    // Mock global fetch
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes("/api/graph/reset")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: "SUCCESS",
                tenant_id: "tenant_project_alpha",
                nodes: mockGraphState.nodes,
                links: mockGraphState.links,
              }),
          });
        }
        if (url.includes("/api/graph/state")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockGraphState),
          });
        }
        if (url.includes("/api/health")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: "healthy",
                falkordb: "connected",
                tenants: ["tenant_project_alpha", "tenant_project_beta"],
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch url: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders top navigation bar with tenant dropdown and action buttons", async () => {
    render(<Dashboard />);

    expect(screen.getByText(/Active Engineering Memory Layer/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText(/Reset & Seed Graph/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Act 1: Session 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Act 1: Session 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Act 2: Refactor PaymentRetryWorker/i)).toBeInTheDocument();

    // Verify initial graph state was fetched
    await waitFor(() => {
      expect(screen.getByText(/PaymentRetryWorker/i)).toBeInTheDocument();
    });
  });

  it("triggers state fetch when switching tenants", async () => {
    render(<Dashboard />);

    const select = screen.getByRole("combobox");
    await act(async () => {
      fireEvent.change(select, { target: { value: "tenant_project_beta" } });
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("tenant_id=tenant_project_beta")
      );
    });
  });

  it("renders 'Explain Decision Path' drawer with 3-hop context when GUARDRAIL_TRIGGERED event arrives", async () => {
    render(<Dashboard />);

    // Click Act 2 Guardrail scenario button
    const act2Btn = screen.getByText(/Run Act 2: Refactor PaymentRetryWorker/i);
    await act(async () => {
      fireEvent.click(act2Btn);
    });

    expect(MockEventSource.instances.length).toBeGreaterThan(0);
    const sse = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Emit GUARDRAIL_TRIGGERED event
    await act(async () => {
      sse.emit({
        event_id: "evt_gr_1",
        timestamp: "2026-10-16T06:30:00Z",
        event_type: "GUARDRAIL_TRIGGERED",
        session_id: "sess_test_b",
        module_name: "PaymentRetryWorker",
        decision_id: "dec_19",
        jira_ticket: "PAY-409",
        vcs_comment: "DO NOT upgrade to /v2/charge/batch here! Legacy partner bank gateway drops webhooks if batched > 1.",
        engineer_owner: "Aarav",
        path_nodes: ["PaymentRetryWorker", "dec_19", "PAY-409", "pr_882_c4", "Aarav"],
      });
    });

    // Assert that the drawer opens with the exact 3-hop invariant elements
    await waitFor(() => {
      const drawer = screen.getByRole("dialog");
      expect(drawer).toBeInTheDocument();
      expect(within(drawer).getByText(/Active Engineering Guardrail Triggered/i)).toBeInTheDocument();
      expect(within(drawer).getByText(/PAY-409/i)).toBeInTheDocument();
      expect(within(drawer).getAllByText(/pr_882_c4/i).length).toBeGreaterThan(0);
      expect(within(drawer).getAllByText(/Aarav/i).length).toBeGreaterThan(0);
      expect(within(drawer).getByText(/DO NOT upgrade to \/v2\/charge\/batch here/i)).toBeInTheDocument();
    });
  });

  it("renders MCP Tool Call details with Cypher query snippet and latency", async () => {
    render(<Dashboard />);

    const act1Btn = screen.getByText(/Run Act 1: Session 1/i);
    await act(async () => {
      fireEvent.click(act1Btn);
    });

    const sse = MockEventSource.instances[MockEventSource.instances.length - 1];

    await act(async () => {
      sse.emit({
        event_id: "evt_mcp_1",
        timestamp: "2026-10-16T06:30:01Z",
        event_type: "MCP_TOOL_CALL",
        session_id: "sess_test_a1",
        tool_name: "get_procedural_route",
        arguments: { module_name: "TokenIngestionWorker" },
        cypher_executed: "MATCH (m:CodeModule {name: 'TokenIngestionWorker'})-[r:EXECUTES_STEP]->(api:APIEndpoint) RETURN api.name",
        latency_ms: 11.5,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/get_procedural_route/i)).toBeInTheDocument();
      expect(screen.getByText(/MATCH \(m:CodeModule/i)).toBeInTheDocument();
      expect(screen.getByText(/11.5ms/i)).toBeInTheDocument();
    });
  });

  it("updates endpoint node status to DEPRECATED when GRAPH_MUTATION event arrives", async () => {
    render(<Dashboard />);

    const act1Btn = screen.getByText(/Run Act 1: Session 1/i);
    await act(async () => {
      fireEvent.click(act1Btn);
    });

    const sse = MockEventSource.instances[MockEventSource.instances.length - 1];

    await act(async () => {
      sse.emit({
        event_id: "evt_mut_1",
        timestamp: "2026-10-16T06:30:02Z",
        event_type: "GRAPH_MUTATION",
        session_id: "sess_test_a1",
        mutation_type: "MERGE_RELATIONSHIP",
        affected_nodes: ["Failure(ep_1)", "APIEndpoint(/v1/legacy-auth)", "APIEndpoint(/v3/oauth/token)"],
        affected_edges: ["EXECUTES_STEP", "DEPRECATES"],
        summary: "Graph Stigmergy Mutation: Deprecated /v1/legacy-auth and healed route to /v3/oauth/token",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Graph Stigmergy Mutation/i)).toBeInTheDocument();
      expect(screen.getByText(/Deprecated \/v1\/legacy-auth/i)).toBeInTheDocument();
    });
  });

  it("renders SESSION_COMPLETE with FAILED status with failure alert card", async () => {
    render(<Dashboard />);

    const act1Btn = screen.getByText(/Run Act 1: Session 2/i);
    await act(async () => {
      fireEvent.click(act1Btn);
    });

    const sse = MockEventSource.instances[MockEventSource.instances.length - 1];

    await act(async () => {
      sse.emit({
        event_id: "evt_comp_fail",
        timestamp: "2026-10-16T06:30:03Z",
        event_type: "SESSION_COMPLETE",
        session_id: "sess_test_fail",
        status: "FAILED",
        final_summary: "Swarm execution halted due to unhealed route.",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/SESSION_COMPLETE: FAILED/i)).toBeInTheDocument();
      expect(screen.getByText(/Swarm execution halted due to unhealed route/i)).toBeInTheDocument();
    });
  });
});
