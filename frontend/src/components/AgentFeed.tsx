import React, { useState } from "react";
import {
  Terminal,
  Bot,
  Wrench,
  Network,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  MemoryLayerEvent,
  AgentStepEvent,
  McpToolCallEvent,
  GraphMutationEvent,
  GuardrailTriggeredEvent,
  SessionCompleteEvent,
} from "../types/events";

interface AgentFeedProps {
  events: MemoryLayerEvent[];
  onOpenExplainDrawer: (event: GuardrailTriggeredEvent) => void;
}

export default function AgentFeed({ events, onOpenExplainDrawer }: AgentFeedProps) {
  const [expandedMcp, setExpandedMcp] = useState<Record<string, boolean>>({});

  const toggleMcp = (id: string) => {
    setExpandedMcp((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] border-r border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Live Multi-Agent &amp; MCP Stream
          </h2>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          {events.length} events
        </span>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-500">
            <div className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-600">
              <Bot className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-slate-400">No active agent execution</p>
            <p className="text-xs max-w-xs text-slate-500">
              Select one of the scenario buttons in the top navbar to trigger real-time multi-agent reasoning.
            </p>
          </div>
        ) : (
          events.map((event, idx) => {
            if (event.event_type === "AGENT_STEP") {
              const step = event as AgentStepEvent;
              return (
                <div
                  key={step.event_id || idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-cyan-300">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span>{step.agent_name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {step.timestamp.split("T")[1]?.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic bg-black/30 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed font-sans">
                    "{step.thought}"
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono">
                    <span className="text-slate-500">&gt;</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                      {step.action}
                    </span>
                  </div>
                </div>
              );
            }

            if (event.event_type === "MCP_TOOL_CALL") {
              const mcpEvt = event as McpToolCallEvent;
              const isExpanded = expandedMcp[mcpEvt.event_id] ?? true;
              return (
                <div
                  key={mcpEvt.event_id || idx}
                  className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 overflow-hidden hover:border-indigo-700/60 transition"
                >
                  <button
                    onClick={() => toggleMcp(mcpEvt.event_id)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-indigo-950/30 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-200 font-mono">
                        {mcpEvt.tool_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Clock className="w-3 h-3" />
                        {mcpEvt.latency_ms.toFixed(1)}ms
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && mcpEvt.cypher_executed && (
                    <div className="px-3 pb-3 pt-1 border-t border-indigo-900/30 bg-black/40 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        FalkorDB Cypher Traversal
                      </span>
                      <pre className="text-[11px] font-mono text-cyan-300 p-2.5 rounded-lg bg-black/60 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {mcpEvt.cypher_executed}
                      </pre>
                    </div>
                  )}
                </div>
              );
            }

            if (event.event_type === "GRAPH_MUTATION") {
              const mut = event as GraphMutationEvent;
              return (
                <div
                  key={mut.event_id || idx}
                  className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 space-y-2 hover:border-cyan-500/50 transition"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                    <Network className="w-4 h-4 text-cyan-400" />
                    <span>GRAPH_MUTATION</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 ml-auto">
                      {mut.mutation_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{mut.summary}</p>
                  <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                    {mut.affected_nodes.map((node, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300"
                      >
                        {node}
                      </span>
                    ))}
                  </div>
                </div>
              );
            }

            if (event.event_type === "GUARDRAIL_TRIGGERED") {
              const gr = event as GuardrailTriggeredEvent;
              return (
                <div
                  key={gr.event_id || idx}
                  className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 space-y-3 shadow-lg shadow-amber-950/20"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <span>GUARDRAIL_TRIGGERED</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ml-auto font-mono">
                      {gr.decision_id}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-300">
                      Module <span className="font-mono text-cyan-400">{gr.module_name}</span> is protected by ADR{" "}
                      <span className="font-mono text-purple-300 font-bold">{gr.decision_id}</span> ({gr.jira_ticket}).
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Owner: <span className="text-slate-200 font-semibold">{gr.engineer_owner}</span> (Staff Systems Architect)
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenExplainDrawer(gr)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition"
                  >
                    <span>Explain Decision Path</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            if (event.event_type === "SESSION_COMPLETE") {
              const comp = event as SessionCompleteEvent;
              const isBlocked = comp.status === "BLOCKED_BY_GUARDRAIL";
              return (
                <div
                  key={comp.event_id || idx}
                  className={`p-4 rounded-xl border space-y-2 ${
                    isBlocked
                      ? "border-rose-500/40 bg-rose-950/30 text-rose-200"
                      : "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {isBlocked ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>SESSION_COMPLETE: {comp.status}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{comp.final_summary}</p>
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
}
