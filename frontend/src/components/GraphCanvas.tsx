"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  EdgeLabelRenderer,
  MarkerType,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeProps,
  type EdgeProps,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Cpu,
  Globe,
  FileText,
  AlertCircle,
  MessageSquare,
  User,
  Shield,
  Layers,
  Zap,
  Users,
  AlertTriangle,
  Server,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// Public Types (re-exported for Dashboard.tsx)
// ═══════════════════════════════════════════════════════════════════════

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
  isLoading?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Color & Style Palettes
// ═══════════════════════════════════════════════════════════════════════

const NODE_PALETTE: Record<string, { bg: string; border: string; text: string; accent: string; minimap: string }> = {
  Service:     { bg: "#0c1a2e", border: "#1d4ed8", text: "#93c5fd", accent: "#3b82f6", minimap: "#3b82f6" },
  CodeModule:  { bg: "#0c1f2e", border: "#0e7490", text: "#67e8f9", accent: "#06b6d4", minimap: "#06b6d4" },
  APIEndpoint: { bg: "#0c2e1a", border: "#15803d", text: "#86efac", accent: "#22c55e", minimap: "#22c55e" },
  Decision:    { bg: "#1a0c2e", border: "#7e22ce", text: "#d8b4fe", accent: "#a855f7", minimap: "#a855f7" },
  JiraTicket:  { bg: "#2e1a0c", border: "#b45309", text: "#fcd34d", accent: "#f59e0b", minimap: "#f59e0b" },
  VCSComment:  { bg: "#2e0c1a", border: "#be185d", text: "#fda4af", accent: "#f43f5e", minimap: "#f43f5e" },
  Engineer:    { bg: "#1a0c2e", border: "#6d28d9", text: "#c4b5fd", accent: "#8b5cf6", minimap: "#8b5cf6" },
  Guardrail:   { bg: "#2e0c0c", border: "#dc2626", text: "#fca5a5", accent: "#ef4444", minimap: "#ef4444" },
  Failure:     { bg: "#2e2e0c", border: "#ca8a04", text: "#fde68a", accent: "#eab308", minimap: "#eab308" },
  Agent:       { bg: "#0c2e2e", border: "#0d9488", text: "#5eead4", accent: "#14b8a6", minimap: "#14b8a6" },
  Incident:    { bg: "#2e1a0c", border: "#c2410c", text: "#fdba74", accent: "#f97316", minimap: "#f97316" },
  Team:        { bg: "#0c1a2e", border: "#2563eb", text: "#93c5fd", accent: "#3b82f6", minimap: "#3b82f6" },
};

const DEFAULT_PALETTE = { bg: "#111827", border: "#374151", text: "#d1d5db", accent: "#6b7280", minimap: "#6b7280" };

function getPalette(label: string) {
  return NODE_PALETTE[label] || DEFAULT_PALETTE;
}

const EDGE_COLORS: Record<string, string> = {
  IMPLEMENTS:     "#a855f7",
  FORCED_BY:      "#f59e0b",
  EXPLAINED_IN:   "#f43f5e",
  AUTHORED:       "#8b5cf6",
  PROTECTS:       "#ef4444",
  ENFORCES:       "#dc2626",
  EXECUTES_STEP:  "#22c55e",
  FALLBACK_STEP:  "#6366f1",
  SUPERSEDED_BY:  "#f97316",
  CONTAINS:       "#3b82f6",
  DEPENDS_ON:     "#60a5fa",
  CALLS:          "#06b6d4",
  EXPOSES:        "#14b8a6",
  GOVERNS:        "#a855f7",
  MITIGATES:      "#ef4444",
  MAINTAINS:      "#8b5cf6",
  OWNS:           "#3b82f6",
  MEMBER_OF:      "#6366f1",
  RESOLVED:       "#22c55e",
  INVESTIGATED:   "#f97316",
  COLLABORATES_WITH: "#60a5fa",
  CONTRIBUTED_TO: "#06b6d4",
  LOGGED_EPISODE: "#eab308",
  DEPRECATES:     "#ef4444",
};

function getEdgeColor(type: string): string {
  return EDGE_COLORS[type] || "#475569";
}

function getNodeIcon(label: string) {
  const iconClass = "w-3.5 h-3.5 flex-shrink-0";
  switch (label) {
    case "CodeModule":   return <Cpu className={iconClass} />;
    case "APIEndpoint":  return <Globe className={iconClass} />;
    case "Decision":     return <FileText className={iconClass} />;
    case "JiraTicket":   return <AlertCircle className={iconClass} />;
    case "VCSComment":   return <MessageSquare className={iconClass} />;
    case "Engineer":     return <User className={iconClass} />;
    case "Guardrail":    return <Shield className={iconClass} />;
    case "Failure":      return <Zap className={iconClass} />;
    case "Incident":     return <AlertTriangle className={iconClass} />;
    case "Team":         return <Users className={iconClass} />;
    case "Service":      return <Server className={iconClass} />;
    case "Agent":        return <Cpu className={iconClass} />;
    default:             return <Layers className={iconClass} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Custom Graph Node Component
// ═══════════════════════════════════════════════════════════════════════

interface CustomNodeData {
  graphNode: GraphNode;
  isHighlighted: boolean;
  [key: string]: unknown;
}

function GraphNodeComponent({ data }: NodeProps<RFNode<CustomNodeData>>) {
  const { graphNode, isHighlighted } = data;
  const palette = getPalette(graphNode.label);
  const isDeprecated =
    graphNode.properties?.status === "DEPRECATED" ||
    graphNode.properties?.is_deprecated === true;

  const displayName =
    graphNode.properties?.name ||
    graphNode.properties?.title ||
    graphNode.properties?.id ||
    graphNode.id;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: palette.accent, border: "none", width: 6, height: 6 }}
      />
      <div
        className={`
          relative px-3 py-2 rounded-xl border-[1.5px] min-w-[140px] max-w-[200px]
          transition-all duration-300 ease-out
          ${isHighlighted ? "ring-2 ring-amber-400 shadow-lg shadow-amber-500/30 scale-105" : ""}
          ${isDeprecated ? "opacity-60" : ""}
        `}
        style={{
          background: palette.bg,
          borderColor: isHighlighted ? "#fbbf24" : isDeprecated ? "#dc2626" : palette.border,
        }}
      >
        {/* Label Type Badge */}
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-1" style={{ color: palette.text }}>
            {getNodeIcon(graphNode.label)}
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {graphNode.label}
            </span>
          </div>
          {isDeprecated && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 border border-red-500/40 uppercase">
              Deprecated
            </span>
          )}
          {graphNode.properties?.status === "SUBOPTIMAL_WORKAROUND" && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-500/40 uppercase">
              Workaround
            </span>
          )}
        </div>

        {/* Primary Name */}
        <div
          className="text-[11px] font-bold leading-tight truncate"
          style={{ color: palette.text }}
          title={String(displayName)}
        >
          {displayName}
        </div>

        {/* Subtitle / Summary */}
        {graphNode.properties?.summary && (
          <div className="text-[9px] mt-0.5 line-clamp-2 opacity-60" style={{ color: palette.text }}>
            {graphNode.properties.summary}
          </div>
        )}
        {graphNode.properties?.role && (
          <div className="text-[9px] mt-0.5 italic opacity-70" style={{ color: palette.text }}>
            {graphNode.properties.role}
          </div>
        )}

        {/* Highlight Pulse Animation */}
        {isHighlighted && (
          <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
            <span className="absolute w-3 h-3 rounded-full bg-amber-400 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-amber-400" />
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: palette.accent, border: "none", width: 6, height: 6 }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Custom Edge Component with Labels
// ═══════════════════════════════════════════════════════════════════════

interface CustomEdgeData {
  relType: string;
  isHighlighted: boolean;
  edgeProperties: Record<string, unknown>;
  [key: string]: unknown;
}

function GraphEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
}: EdgeProps<RFEdge<CustomEdgeData>>) {
  const relType = data?.relType || "RELATED_TO";
  const isHighlighted = data?.isHighlighted || false;
  const color = isHighlighted ? "#fbbf24" : getEdgeColor(relType);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: isHighlighted ? 2.5 : 1.2,
          opacity: isHighlighted ? 1 : 0.5,
          strokeDasharray: relType === "SUPERSEDED_BY" || relType === "FALLBACK_STEP" ? "6 3" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <span
            className="text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
            style={{
              background: `${color}15`,
              borderColor: `${color}40`,
              color: color,
              opacity: isHighlighted ? 1 : 0.7,
            }}
          >
            {relType}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// Register node and edge types outside component to prevent re-creation
const nodeTypes = { graphNode: GraphNodeComponent };
const edgeTypes = { graphEdge: GraphEdgeComponent };

// ═══════════════════════════════════════════════════════════════════════
// Layout Algorithm: Hierarchical grouping by node label
// ═══════════════════════════════════════════════════════════════════════

const LABEL_ORDER = [
  "Service",
  "Team",
  "Engineer",
  "CodeModule",
  "APIEndpoint",
  "Decision",
  "JiraTicket",
  "VCSComment",
  "Guardrail",
  "Incident",
  "Agent",
  "Failure",
];

function computeLayout(
  graphNodes: GraphNode[],
  highlightedIds: string[]
): { rfNodes: RFNode<CustomNodeData>[]; } {
  // Group nodes by label type
  const groups: Record<string, GraphNode[]> = {};
  for (const gn of graphNodes) {
    const label = gn.label || "Unknown";
    if (!groups[label]) groups[label] = [];
    groups[label].push(gn);
  }

  const rfNodes: RFNode<CustomNodeData>[] = [];
  const orderedLabels = LABEL_ORDER.filter((l) => groups[l]);
  // Append any labels not in LABEL_ORDER
  for (const label of Object.keys(groups)) {
    if (!orderedLabels.includes(label)) orderedLabels.push(label);
  }

  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 80;
  const H_GAP = 40;
  const V_GAP = 50;
  const COLS_PER_ROW = 5;

  let currentY = 40;

  for (const label of orderedLabels) {
    const nodesInGroup = groups[label];
    if (!nodesInGroup) continue;

    for (let i = 0; i < nodesInGroup.length; i++) {
      const col = i % COLS_PER_ROW;
      const row = Math.floor(i / COLS_PER_ROW);

      rfNodes.push({
        id: nodesInGroup[i].id,
        type: "graphNode",
        position: {
          x: 40 + col * (NODE_WIDTH + H_GAP),
          y: currentY + row * (NODE_HEIGHT + V_GAP),
        },
        data: {
          graphNode: nodesInGroup[i],
          isHighlighted:
            highlightedIds.includes(nodesInGroup[i].id) ||
            (!!nodesInGroup[i].properties?.name &&
              highlightedIds.includes(String(nodesInGroup[i].properties.name))),
        },
      });
    }

    const rows = Math.ceil(nodesInGroup.length / COLS_PER_ROW);
    currentY += rows * (NODE_HEIGHT + V_GAP) + 30;
  }

  return { rfNodes };
}

// ═══════════════════════════════════════════════════════════════════════
// Main GraphCanvas Component
// ═══════════════════════════════════════════════════════════════════════

export default function GraphCanvas({
  nodes: graphNodes,
  links: graphLinks,
  highlightedNodeIds = [],
  onNodeSelect,
  isLoading = false,
}: GraphCanvasProps) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<RFNode<CustomNodeData>>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<RFEdge<CustomEdgeData>>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);

  // Compute layout whenever input data changes
  useEffect(() => {
    if (!graphNodes.length) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }

    const visibleNodes = filterLabel
      ? graphNodes.filter((n) => n.label === filterLabel)
      : graphNodes;

    const { rfNodes: layoutNodes } = computeLayout(visibleNodes, highlightedNodeIds);
    setRfNodes(layoutNodes);

    // Convert graph links to React Flow edges
    const nodeIdSet = new Set(visibleNodes.map((n) => n.id));
    const edges: RFEdge<CustomEdgeData>[] = graphLinks
      .filter((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target))
      .map((link) => {
        const isHighlighted =
          highlightedNodeIds.includes(link.source) && highlightedNodeIds.includes(link.target);
        return {
          id: link.id,
          source: link.source,
          target: link.target,
          type: "graphEdge",
          data: {
            relType: link.type,
            isHighlighted,
            edgeProperties: link.properties,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? "#fbbf24" : getEdgeColor(link.type),
            width: 14,
            height: 14,
          },
          animated: isHighlighted || link.type === "SUPERSEDED_BY" || link.type === "FALLBACK_STEP",
        };
      });
    setRfEdges(edges);
  }, [graphNodes, graphLinks, highlightedNodeIds, filterLabel, setRfNodes, setRfEdges]);

  // Node click handler
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RFNode<CustomNodeData>) => {
      const gn = node.data?.graphNode;
      if (gn) {
        setSelectedNode(gn);
        if (onNodeSelect) onNodeSelect(gn);
      }
    },
    [onNodeSelect]
  );

  // Unique labels for legend
  const activeLabels = useMemo(() => {
    const labels = new Set(graphNodes.map((n) => n.label));
    return Array.from(labels).sort();
  }, [graphNodes]);

  // MiniMap node color
  const minimapNodeColor = useCallback(
    (node: RFNode<CustomNodeData>) => {
      const label = node.data?.graphNode?.label;
      return label ? getPalette(label).minimap : "#6b7280";
    },
    []
  );

  return (
    <div className="flex flex-col h-full bg-[#070b14] overflow-hidden relative">
      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: "#070b14" }}
          defaultEdgeOptions={{ type: "graphEdge" }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls
            showInteractive={false}
            position="bottom-right"
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgba(7, 11, 20, 0.85)"
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "12px",
            }}
            pannable
            zoomable
          />

          {/* Legend Panel */}
          <Panel position="top-left">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur-sm space-y-1.5 max-w-sm">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                <span>Node Types {filterLabel && `(Filtered: ${filterLabel})`}</span>
                {filterLabel && (
                  <button
                    onClick={() => setFilterLabel(null)}
                    className="text-cyan-400 hover:text-cyan-200 capitalize text-[9px]"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeLabels.map((label) => {
                  const pal = getPalette(label);
                  const isSelected = filterLabel === label;
                  return (
                    <button
                      key={label}
                      onClick={() => setFilterLabel(isSelected ? null : label)}
                      className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border transition cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-cyan-400 font-bold scale-105"
                          : filterLabel
                          ? "opacity-40 hover:opacity-100"
                          : "hover:scale-105"
                      }`}
                      style={{
                        background: `${pal.accent}20`,
                        borderColor: isSelected ? "#22d3ee" : `${pal.accent}50`,
                        color: pal.text,
                      }}
                      title={`Click to filter by ${label}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: pal.accent }}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* Stats Panel */}
          <Panel position="top-right">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 backdrop-blur-sm flex items-center gap-4 text-[11px] font-mono text-slate-400">
              <span>
                Nodes: <strong className="text-cyan-300">{graphNodes.length}</strong>
              </span>
              <span>
                Edges: <strong className="text-indigo-300">{graphLinks.length}</strong>
              </span>
              {highlightedNodeIds.length > 0 && (
                <span className="text-amber-400">
                  ⚡ {highlightedNodeIds.length} traversed
                </span>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Selected Node Inspector */}
      {selectedNode && (
        <div className="absolute bottom-16 left-4 right-4 max-w-md z-10 p-4 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl space-y-2 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              {getNodeIcon(selectedNode.label)}
              <span
                className="text-xs font-bold font-mono"
                style={{ color: getPalette(selectedNode.label).text }}
              >
                {selectedNode.properties?.name ||
                  selectedNode.properties?.title ||
                  selectedNode.id}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {selectedNode.label}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-slate-400 hover:text-white transition px-2 py-0.5 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>
          <pre className="text-[11px] font-mono text-slate-300 p-2.5 rounded bg-black/50 border border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
            {JSON.stringify(selectedNode.properties, null, 2)}
          </pre>
        </div>
      )}

      {/* Loading Skeleton Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#070b14]/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute w-8 h-8 rounded-full border-2 border-indigo-500/30 border-b-indigo-400 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-200">Synchronizing FalkorDB Knowledge Graph</p>
            <p className="text-xs text-slate-400 font-mono">Loading active memory topology &amp; constraints...</p>
          </div>
        </div>
      )}
    </div>
  );
}
