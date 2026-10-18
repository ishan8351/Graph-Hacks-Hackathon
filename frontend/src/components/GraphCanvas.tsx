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
  Service:     { bg: "#fafaf6", border: "#8e9ca1", text: "#273b42", accent: "#426c7c", minimap: "#426c7c" },
  CodeModule:  { bg: "#fafaf6", border: "#8196a2", text: "#263c4d", accent: "#315b78", minimap: "#315b78" },
  APIEndpoint: { bg: "#fafaf6", border: "#8ea89a", text: "#30483c", accent: "#47745b", minimap: "#47745b" },
  Decision:    { bg: "#fafaf6", border: "#8d91aa", text: "#393d58", accent: "#5c628c", minimap: "#5c628c" },
  JiraTicket:  { bg: "#fafaf6", border: "#c29b77", text: "#5d422b", accent: "#a76731", minimap: "#a76731" },
  VCSComment:  { bg: "#fafaf6", border: "#bb9382", text: "#553a32", accent: "#9f5942", minimap: "#9f5942" },
  Engineer:    { bg: "#fafaf6", border: "#9a91a5", text: "#463b50", accent: "#71607d", minimap: "#71607d" },
  Guardrail:   { bg: "#fafaf6", border: "#d38967", text: "#6b321f", accent: "#c75222", minimap: "#c75222" },
  Failure:     { bg: "#fafaf6", border: "#c29e6c", text: "#5a4527", accent: "#9b702a", minimap: "#9b702a" },
  Agent:       { bg: "#fafaf6", border: "#7da59d", text: "#294c45", accent: "#39796d", minimap: "#39796d" },
  Incident:    { bg: "#fafaf6", border: "#c58d71", text: "#5b3929", accent: "#a45d3c", minimap: "#a45d3c" },
  Team:        { bg: "#fafaf6", border: "#8da2bd", text: "#30465e", accent: "#476b98", minimap: "#476b98" },
};

const DEFAULT_PALETTE = { bg: "#fafaf6", border: "#a3aaa1", text: "#3c443d", accent: "#68746b", minimap: "#68746b" };

function getPalette(label: string) {
  return NODE_PALETTE[label] || DEFAULT_PALETTE;
}

const EDGE_COLORS: Record<string, string> = {
  IMPLEMENTS:     "#315b78", FORCED_BY: "#a76731", EXPLAINED_IN: "#9f5942",
  AUTHORED:       "#71607d", PROTECTS: "#c75222", ENFORCES: "#c75222",
  EXECUTES_STEP:  "#47745b", FALLBACK_STEP: "#5c628c", SUPERSEDED_BY: "#a45d3c",
  CONTAINS:       "#476b98", DEPENDS_ON: "#557799", CALLS: "#426c7c",
  EXPOSES:        "#39796d", GOVERNS: "#5c628c", MITIGATES: "#c75222",
  MAINTAINS:      "#71607d", OWNS: "#476b98", MEMBER_OF: "#5c628c",
  RESOLVED:       "#47745b", INVESTIGATED: "#a45d3c", COLLABORATES_WITH: "#557799",
  CONTRIBUTED_TO: "#426c7c", LOGGED_EPISODE: "#9b702a", DEPRECATES: "#c75222",
};

function getEdgeColor(type: string): string {
  return EDGE_COLORS[type] || "#858d87";
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
        className={`graph-node relative
          ${isHighlighted ? "ring-2 scale-105" : ""}
          ${isDeprecated ? "opacity-60" : ""}
        `}
        style={{
          background: palette.bg,
          borderColor: isHighlighted ? "#c75222" : isDeprecated ? "#a94832" : palette.border,
          "--node-accent": palette.accent,
          "--node-rule": palette.border,
        } as React.CSSProperties & { "--node-accent": string; "--node-rule": string }}
      >
        {/* Label Type Badge */}
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <div className="graph-node-type flex items-center gap-1" style={{ color: palette.accent }}>
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
          className="graph-node-name truncate"
          style={{ color: palette.text }}
          title={String(displayName)}
        >
          {displayName}
        </div>

        {/* Subtitle / Summary */}
        {graphNode.properties?.summary && (
          <div className="graph-node-copy mt-0.5 line-clamp-2">
            {graphNode.properties.summary}
          </div>
        )}
        {graphNode.properties?.role && (
          <div className="graph-node-copy mt-0.5 italic">
            {graphNode.properties.role}
          </div>
        )}

        {/* Highlight Pulse Animation */}
        {isHighlighted && (
          <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
            <span className="absolute w-3 h-3 rounded-full bg-orange-600 animate-ping opacity-75" />
            <span className="relative w-2 h-2 rounded-full bg-orange-700" />
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
  const color = isHighlighted ? "#c75222" : getEdgeColor(relType);

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
            className="graph-edge-label whitespace-nowrap"
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
            color: isHighlighted ? "#c75222" : getEdgeColor(link.type),
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
    <div className="relationship-canvas flex h-full flex-col overflow-hidden relative">
      {/* React Flow Canvas */}
      <div className="min-h-0 flex-1">
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
          style={{ background: "#eeefe9" }}
          defaultEdgeOptions={{ type: "graphEdge" }}
        >
          <Background color="#cfd3ca" gap={22} size={1} />
          <Controls
            showInteractive={false}
            position="bottom-right"
            style={{
              background: "#fafaf6",
              border: "1px solid #bfc4bc",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgba(238, 239, 233, 0.78)"
            style={{
              background: "#fafaf6",
              border: "1px solid #bfc4bc",
              borderRadius: "2px",
            }}
            pannable
            zoomable
          />

          {/* Legend Panel */}
          <Panel position="top-left">
            <div className="canvas-legend space-y-1.5">
              <div className="canvas-legend-title flex items-center justify-between mb-1">
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
                      className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 border transition cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-blue-700 font-bold scale-105"
                          : filterLabel
                          ? "opacity-40 hover:opacity-100"
                          : "hover:scale-105"
                      }`}
                      style={{
                        background: `${pal.accent}20`,
                        borderColor: isSelected ? "#2456c5" : `${pal.accent}50`,
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
            <div className="canvas-stats flex items-center gap-4">
              <span>
                Nodes: <strong className="text-cyan-700">{graphNodes.length}</strong>
              </span>
              <span>
                Edges: <strong className="text-indigo-700">{graphLinks.length}</strong>
              </span>
              {highlightedNodeIds.length > 0 && (
                <span className="text-amber-400">
                  {highlightedNodeIds.length} in guardrail path
                </span>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {!isLoading && graphNodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
          <div className="canvas-empty">
            <div className="canvas-empty-icon mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border">
              <Layers className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-200">No graph data loaded</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Make sure FalkorDB and the API are running, then click Reset graph to load the nodes.
            </p>
          </div>
        </div>
      )}

      {/* Selected Node Inspector */}
      {selectedNode && (
        <div className="node-inspector absolute bottom-16 left-4 right-4 max-w-md z-10 p-4 space-y-2 animate-in slide-in-from-bottom duration-200">
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
        <div className="absolute inset-0 bg-[#eeefe9]/90 z-30 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute w-8 h-8 rounded-full border-2 border-indigo-500/30 border-b-indigo-400 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-200">Loading FalkorDB graph</p>
            <p className="text-xs text-slate-400 font-mono">Fetching nodes and relationships...</p>
          </div>
        </div>
      )}
    </div>
  );
}
