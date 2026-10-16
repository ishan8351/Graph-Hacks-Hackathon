"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import TopNav from "./TopNav";
import AgentFeed from "./AgentFeed";
import GraphCanvas, { GraphNode, GraphLink } from "./GraphCanvas";
import ExplainDecisionDrawer from "./ExplainDecisionDrawer";
import CypherPlaygroundModal from "./CypherPlaygroundModal";
import SessionHistoryModal, { SessionRecord } from "./SessionHistoryModal";
import ArchitectureGuideModal from "./ArchitectureGuideModal";
import {
  MemoryLayerEvent,
  GuardrailTriggeredEvent,
  GraphMutationEvent,
  SessionCompleteEvent,
} from "../types/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SCENARIO_TITLES: Record<string, string> = {
  "scenario-a1": "Act 1: Session 1 (410 Gone & Stigmergy)",
  "scenario-a2": "Act 1: Session 2 (Zero-Shot Self-Healing Route)",
  "scenario-b": "Act 2: Refactor PaymentRetryWorker (3-Hop Guardrail)",
};

export default function Dashboard() {
  const [tenant, setTenant] = useState<string>("tenant_project_alpha");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [events, setEvents] = useState<MemoryLayerEvent[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected" | "idle" | "live"
  >("connected");

  // Explainability Drawer state
  const [guardrailEvent, setGuardrailEvent] = useState<GuardrailTriggeredEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  // Modals state
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Session history state
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const activeEventSource = useRef<EventSource | null>(null);

  // Load session history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("active_memory_sessions");
      if (saved) {
        setSessions(JSON.parse(saved));
      }
    } catch {
      // LocalStorage error fallback
    }
  }, []);

  // Save session history to localStorage
  const saveSession = useCallback((record: SessionRecord) => {
    setSessions((prev) => {
      const updated = [record, ...prev].slice(0, 20);
      try {
        localStorage.setItem("active_memory_sessions", JSON.stringify(updated));
      } catch {
        // Ignore localStorage quota
      }
      return updated;
    });
  }, []);

  // Fetch live FalkorDB graph state
  const fetchGraphState = useCallback(async (tenantId: string) => {
    setIsLoadingGraph(true);
    try {
      const res = await fetch(`${API_BASE}/api/graph/state?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setLinks(data.links || []);
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (err) {
      console.warn("Failed to fetch graph state:", err);
      setConnectionStatus("disconnected");
    } finally {
      setIsLoadingGraph(false);
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
    setIsLoadingGraph(true);
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
        setConnectionStatus("connected");
      }
    } catch (err) {
      console.error("Failed to reset graph:", err);
      setConnectionStatus("disconnected");
    } finally {
      setIsRunning(false);
      setIsLoadingGraph(false);
    }
  };

  // Start Real-Time SSE Stream for a scenario
  const startScenarioStream = useCallback((streamEndpoint: string, scenarioId: string) => {
    if (activeEventSource.current) {
      activeEventSource.current.close();
    }

    setEvents([]);
    setIsRunning(true);
    setActiveScenario(scenarioId);
    setConnectionStatus("live");

    const sseUrl = `${API_BASE}${streamEndpoint}?tenant_id=${tenant}`;
    const es = new EventSource(sseUrl);
    activeEventSource.current = es;

    const collectedEvents: MemoryLayerEvent[] = [];

    const handleEventMessage = (e: { data: string }) => {
      try {
        const eventData: MemoryLayerEvent = JSON.parse(e.data);
        collectedEvents.push(eventData);
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
          // Asynchronously refresh fresh state from FalkorDB
          fetchGraphState(tenant);
        }

        // Handle Guardrail Triggered: open explainability drawer & highlight traversed 3-hop nodes
        if (eventData.event_type === "GUARDRAIL_TRIGGERED") {
          const gr = eventData as GuardrailTriggeredEvent;
          setGuardrailEvent(gr);
          setIsDrawerOpen(true);
          setHighlightedNodeIds(gr.path_nodes || []);
        }

        // Handle Session Complete: finalize state and persist to history
        if (eventData.event_type === "SESSION_COMPLETE") {
          const comp = eventData as SessionCompleteEvent;
          setIsRunning(false);
          setActiveScenario(null);
          setConnectionStatus("connected");
          es.close();
          fetchGraphState(tenant);

          saveSession({
            id: `run_${Date.now()}`,
            scenarioName: SCENARIO_TITLES[scenarioId] || scenarioId,
            scenarioId,
            tenant,
            timestamp: new Date().toISOString(),
            eventCount: collectedEvents.length,
            status: comp.status,
            events: [...collectedEvents],
          });
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    es.onmessage = handleEventMessage;
    const EVENT_TYPES = [
      "AGENT_STEP",
      "MCP_TOOL_CALL",
      "GRAPH_MUTATION",
      "GUARDRAIL_TRIGGERED",
      "SESSION_COMPLETE",
    ];
    EVENT_TYPES.forEach((evtType) => {
      es.addEventListener(evtType, (e) => handleEventMessage(e as MessageEvent));
    });

    es.onerror = (err) => {
      console.warn("SSE stream ended or encountered error:", err);
      setIsRunning(false);
      setActiveScenario(null);
      setConnectionStatus("connected");
      es.close();
    };
  }, [tenant, fetchGraphState, saveSession]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
        return;
      }

      if (e.key === "Escape") {
        setIsDrawerOpen(false);
        setIsPlaygroundOpen(false);
        setIsHistoryOpen(false);
        setIsGuideOpen(false);
      } else if (e.key === "1" && !isRunning) {
        startScenarioStream("/api/stream/scenario-a/session-1", "scenario-a1");
      } else if (e.key === "2" && !isRunning) {
        startScenarioStream("/api/stream/scenario-a/session-2", "scenario-a2");
      } else if (e.key === "3" && !isRunning) {
        startScenarioStream("/api/stream/scenario-b/guardrail", "scenario-b");
      } else if ((e.key === "r" || e.key === "R") && !isRunning) {
        handleResetGraph();
      } else if (e.key === "?") {
        setIsGuideOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, startScenarioStream]);

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
        connectionStatus={connectionStatus}
        onOpenPlayground={() => setIsPlaygroundOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
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
            isLoading={isLoadingGraph}
          />
        </div>

        {/* Slide-out Explainability Drawer */}
        <ExplainDecisionDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          guardrailEvent={guardrailEvent}
        />

        {/* Cypher Playground Modal */}
        <CypherPlaygroundModal
          isOpen={isPlaygroundOpen}
          onClose={() => setIsPlaygroundOpen(false)}
          tenantId={tenant}
        />

        {/* Session History Modal */}
        <SessionHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          sessions={sessions}
          onSelectSession={(sess) => {
            setEvents(sess.events);
          }}
          onClearHistory={() => {
            setSessions([]);
            try {
              localStorage.removeItem("active_memory_sessions");
            } catch {
              // Ignore
            }
          }}
        />

        {/* Architecture & Shortcut Guide Modal */}
        <ArchitectureGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      </div>
    </div>
  );
}
