"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import TopNav from "./TopNav";
import AgentFeed from "./AgentFeed";
import GraphCanvas, { GraphNode, GraphLink } from "./GraphCanvas";
import ExplainDecisionDrawer from "./ExplainDecisionDrawer";
import {
  MemoryLayerEvent,
  GuardrailTriggeredEvent,
  GraphMutationEvent,
} from "../types/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Dashboard() {
  const [tenant, setTenant] = useState<string>("tenant_project_alpha");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [events, setEvents] = useState<MemoryLayerEvent[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  // Explainability Drawer state
  const [guardrailEvent, setGuardrailEvent] = useState<GuardrailTriggeredEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  const activeEventSource = useRef<EventSource | null>(null);

  // Fetch live FalkorDB graph state
  const fetchGraphState = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/graph/state?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setLinks(data.links || []);
      }
    } catch (err) {
      console.warn("Failed to fetch graph state:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchGraphState(tenant);
  }, [tenant, fetchGraphState]);

  // Clean up SSE connection on unmount
  useEffect(() => {
    return () => {
      if (activeEventSource.current) {
        activeEventSource.current.close();
      }
    };
  }, []);

  // Tenant change handler
  const handleTenantChange = (newTenant: string) => {
    setTenant(newTenant);
    setEvents([]);
    setGuardrailEvent(null);
    setIsDrawerOpen(false);
    setHighlightedNodeIds([]);
    fetchGraphState(newTenant);
  };

  // 1-Click Reset & Seed Graph
  const handleResetGraph = async () => {
    setIsRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/graph/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant }),
      });
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setLinks(data.links || []);
        setEvents([]);
        setGuardrailEvent(null);
        setIsDrawerOpen(false);
        setHighlightedNodeIds([]);
      }
    } catch (err) {
      console.error("Failed to reset graph:", err);
    } finally {
      setIsRunning(false);
    }
  };

  // Start Real-Time SSE Stream for a scenario
  const startScenarioStream = (streamEndpoint: string, scenarioId: string) => {
    if (activeEventSource.current) {
      activeEventSource.current.close();
    }

    setEvents([]);
    setIsRunning(true);
    setActiveScenario(scenarioId);

    const sseUrl = `${API_BASE}${streamEndpoint}?tenant_id=${tenant}`;
    const es = new EventSource(sseUrl);
    activeEventSource.current = es;

    es.onmessage = (e: { data: string }) => {
      try {
        const eventData: MemoryLayerEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, eventData]);

        // Handle Graph Mutation: immediately update local node statuses
        if (eventData.event_type === "GRAPH_MUTATION") {
          const mut = eventData as GraphMutationEvent;
          setNodes((prevNodes) =>
            prevNodes.map((n) => {
              if (
                mut.affected_nodes.some(
                  (aff) =>
                    aff.includes(n.id) ||
                    (Boolean(n.properties?.name) && aff.includes(n.properties.name!))
                )
              ) {
                return {
                  ...n,
                  properties: {
                    ...n.properties,
                    status: "DEPRECATED",
                    is_deprecated: true,
                  },
                };
              }
              return n;
            })
          );
          // Also asynchronously refresh fresh state
          fetchGraphState(tenant);
        }

        // Handle Guardrail Triggered: open explainability drawer & highlight traversed 3-hop nodes
        if (eventData.event_type === "GUARDRAIL_TRIGGERED") {
          const gr = eventData as GuardrailTriggeredEvent;
          setGuardrailEvent(gr);
          setIsDrawerOpen(true);
          setHighlightedNodeIds(gr.path_nodes || []);
        }

        // Handle Session Complete: finalize state
        if (eventData.event_type === "SESSION_COMPLETE") {
          setIsRunning(false);
          setActiveScenario(null);
          es.close();
          fetchGraphState(tenant);
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    es.onerror = (err) => {
      console.warn("SSE stream ended or encountered error:", err);
      setIsRunning(false);
      setActiveScenario(null);
      es.close();
    };
  };

  return (
    <div className="flex flex-col h-screen bg-[#070b14] text-slate-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <TopNav
        currentTenant={tenant}
        onTenantChange={handleTenantChange}
        onResetGraph={handleResetGraph}
        onRunAct1Session1={() =>
          startScenarioStream("/api/stream/scenario-a/session-1", "scenario-a1")
        }
        onRunAct1Session2={() =>
          startScenarioStream("/api/stream/scenario-a/session-2", "scenario-a2")
        }
        onRunAct2Guardrail={() =>
          startScenarioStream("/api/stream/scenario-b/guardrail", "scenario-b")
        }
        isRunning={isRunning}
        activeScenario={activeScenario}
      />

      {/* Split-Screen Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Panel: Live Multi-Agent Execution & MCP Feed */}
        <div className="w-full md:w-5/12 lg:w-4/12 h-1/2 md:h-full flex-shrink-0">
          <AgentFeed
            events={events}
            onOpenExplainDrawer={(gr) => {
              setGuardrailEvent(gr);
              setIsDrawerOpen(true);
              setHighlightedNodeIds(gr.path_nodes || []);
            }}
          />
        </div>

        {/* Right Panel: Interactive FalkorDB Knowledge Canvas */}
        <div className="w-full md:w-7/12 lg:w-8/12 h-1/2 md:h-full flex-1">
          <GraphCanvas
            nodes={nodes}
            links={links}
            highlightedNodeIds={highlightedNodeIds}
          />
        </div>

        {/* Slide-out Explainability Drawer */}
        <ExplainDecisionDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          guardrailEvent={guardrailEvent}
        />
      </div>
    </div>
  );
}
