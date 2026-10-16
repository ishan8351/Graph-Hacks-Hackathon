import React, { useState } from "react";
import {
  Network,
  Cpu,
  Globe,
  FileText,
  AlertCircle,
  MessageSquare,
  User,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

export interface NodeProperties {
  id?: string;
  name?: string;
  title?: string;
  status?: string;
  is_deprecated?: boolean;
  role?: string;
  summary?: string;
  file_path?: string;
  [key: string]: unknown;
}

export interface GraphNode {
  id: string;
  label: string;
  labels: string[];
  properties: NodeProperties;
  internal_id?: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  highlightedNodeIds?: string[];
  onNodeSelect?: (node: GraphNode) => void;
}

export default function GraphCanvas({
  nodes,
  links,
  highlightedNodeIds = [],
  onNodeSelect,
}: GraphCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterLabel, setFilterLabel] = useState<string>("ALL");

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    if (onNodeSelect) onNodeSelect(node);
  };

  const filteredNodes =
    filterLabel === "ALL"
      ? nodes
      : nodes.filter((n) => n.label === filterLabel || n.labels.includes(filterLabel));

  const getNodeBadgeColor = (node: GraphNode) => {
    const isDeprecated =
      node.properties?.status === "DEPRECATED" ||
      node.properties?.is_deprecated === true;

    if (node.label === "APIEndpoint") {
      return isDeprecated
        ? "border-red-500/60 bg-red-950/40 text-red-300 ring-1 ring-red-500/40"
        : "border-emerald-500/50 bg-emerald-950/40 text-emerald-300";
    }
    if (node.label === "CodeModule") {
      return "border-cyan-500/50 bg-cyan-950/40 text-cyan-300";
    }
    if (node.label === "Decision") {
      return "border-purple-500/50 bg-purple-950/40 text-purple-300";
    }
    if (node.label === "JiraTicket") {
      return "border-amber-500/50 bg-amber-950/40 text-amber-300";
    }
    if (node.label === "VCSComment") {
      return "border-rose-500/50 bg-rose-950/40 text-rose-300";
    }
    if (node.label === "Engineer") {
      return "border-violet-500/50 bg-violet-950/40 text-violet-300";
    }
    if (node.label === "Guardrail") {
      return "border-red-600/60 bg-red-950/50 text-red-200";
    }
    if (node.label === "Failure") {
      return "border-yellow-500/60 bg-yellow-950/50 text-yellow-300 ring-1 ring-yellow-500/50";
    }
    return "border-slate-700 bg-slate-900 text-slate-300";
  };

  const getNodeIcon = (label: string) => {
    switch (label) {
      case "CodeModule":
        return <Cpu className="w-3.5 h-3.5 text-cyan-400" />;
      case "APIEndpoint":
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
      case "Decision":
        return <FileText className="w-3.5 h-3.5 text-purple-400" />;
      case "JiraTicket":
        return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
      case "VCSComment":
        return <MessageSquare className="w-3.5 h-3.5 text-rose-400" />;
      case "Engineer":
        return <User className="w-3.5 h-3.5 text-violet-400" />;
      case "Guardrail":
        return <Shield className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070b14] overflow-hidden">
      {/* Canvas Header / Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            FalkorDB Socio-Technical Knowledge Canvas
          </h2>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
          {["ALL", "CodeModule", "APIEndpoint", "Decision", "JiraTicket", "VCSComment", "Engineer"].map(
            (lbl) => (
              <button
                key={lbl}
                onClick={() => setFilterLabel(lbl)}
                className={`px-2 py-0.5 rounded-full border transition font-mono ${
                  filterLabel === lbl
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {lbl}
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-y-auto p-5 relative">
        {/* Graph Nodes Grid Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredNodes.map((node) => {
            const isHighlighted =
              highlightedNodeIds.includes(node.id) ||
              (Boolean(node.properties?.name) && highlightedNodeIds.includes(node.properties.name!));
            const isSelected = selectedNode?.id === node.id;
            const isDeprecated =
              node.properties?.status === "DEPRECATED" ||
              node.properties?.is_deprecated === true;

            return (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`p-3 rounded-xl border cursor-pointer transition relative group ${getNodeBadgeColor(
                  node
                )} ${
                  isHighlighted
                    ? "ring-2 ring-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02]"
                    : "hover:scale-[1.01]"
                } ${isSelected ? "ring-2 ring-cyan-400" : ""}`}
              >
                {/* Highlight Badge */}
                {isHighlighted && (
                  <span className="absolute -top-2 -right-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5 shadow">
                    <Sparkles className="w-2.5 h-2.5" /> Traversed
                  </span>
                )}

                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {getNodeIcon(node.label)}
                    <span>{node.label}</span>
                  </div>
                  {isDeprecated ? (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                      DEPRECATED
                    </span>
                  ) : (
                    node.properties?.status && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950/40 text-slate-400">
                        {node.properties.status}
                      </span>
                    )
                  )}
                </div>

                <div className="font-mono text-xs font-bold text-slate-100 truncate">
                  {node.properties?.name || node.properties?.title || node.id}
                </div>

                {node.properties?.summary && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {node.properties.summary}
                  </p>
                )}

                {node.properties?.role && (
                  <p className="text-[11px] text-violet-300 mt-1">
                    {node.properties.role}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Node Inspector Drawer / Popover */}
        {selectedNode && (
          <div className="mt-6 p-4 rounded-xl border border-slate-700 bg-slate-900/90 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                {getNodeIcon(selectedNode.label)}
                <span className="text-xs font-bold text-cyan-300 font-mono">
                  {selectedNode.id}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {selectedNode.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 p-2.5 rounded bg-black/50 border border-slate-800 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(selectedNode.properties, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Canvas Footer: Edge Topology Summary */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span>Nodes: <strong className="text-cyan-300">{nodes.length}</strong></span>
          <span>Edges: <strong className="text-indigo-300">{links.length}</strong></span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active Route
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Deprecated / Blocked
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Guardrail Path
          </span>
        </div>
      </div>
    </div>
  );
}
