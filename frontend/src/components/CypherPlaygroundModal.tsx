"use client";

import React, { useState } from "react";
import { Play, X, Terminal, Clock, Copy, Check, Sparkles, AlertCircle } from "lucide-react";

interface CypherPlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

const PRESET_QUERIES = [
  {
    name: "3-Hop Invariant Guardrail Path",
    description: "Traverses Module -> ADR -> Jira -> VCS Comment -> Engineer",
    cypher: `MATCH path = (m:CodeModule)-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(c:VCSComment)<-[:AUTHORED]-(eng:Engineer)
RETURN m.name AS module, d.id AS decision, j.id AS ticket, c.id AS comment, eng.name AS owner`,
  },
  {
    name: "API Endpoints & Status",
    description: "Inspect active vs deprecated endpoints and superseding routes",
    cypher: `MATCH (e:APIEndpoint)
OPTIONAL MATCH (e)-[:SUPERSEDED_BY]->(healed:APIEndpoint)
RETURN e.name AS endpoint, coalesce(e.status, 'ACTIVE') AS status, coalesce(e.is_deprecated, false) AS deprecated, healed.name AS superseded_by
ORDER BY status ASC, endpoint ASC`,
  },
  {
    name: "Engineer Collaboration Centrality",
    description: "Calculate degrees of maintenance, authorship, and ownership",
    cypher: `MATCH (eng:Engineer)-[r]->(target)
RETURN eng.name AS engineer, eng.role AS role, count(r) AS total_edges, count(DISTINCT target) AS distinct_entities
ORDER BY total_edges DESC`,
  },
  {
    name: "Self-Healing Routing Steps",
    description: "View primary EXECUTES_STEP vs FALLBACK_STEP routes",
    cypher: `MATCH (m:CodeModule)-[r:EXECUTES_STEP|FALLBACK_STEP]->(api:APIEndpoint)
RETURN m.name AS module, type(r) AS route_type, api.name AS endpoint, coalesce(r.status, 'ACTIVE') AS edge_status`,
  },
  {
    name: "Failure Episodes (Stigmergy)",
    description: "Inspect runtime failure nodes logged into the graph",
    cypher: `MATCH (f:Failure)
OPTIONAL MATCH (f)-[:LOGGED_EPISODE]->(m)
RETURN f.id AS failure_id, coalesce(f.status_code, 410) AS error_code, coalesce(f.timestamp, 'N/A') AS logged_at, m.name AS affected_module`,
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CypherPlaygroundModal({
  isOpen,
  onClose,
  tenantId,
}: CypherPlaygroundModalProps) {
  const [query, setQuery] = useState<string>(PRESET_QUERIES[0].cypher);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [results, setResults] = useState<{
    columns: string[];
    records: Record<string, unknown>[];
    latency_ms: number;
    count: number;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  if (!isOpen) return null;

  const handleRunQuery = async (queryToRun?: string) => {
    const q = queryToRun || query;
    setIsRunning(true);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/api/graph/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          query: q,
        }),
      });
      const data = await res.json();
      if (data.status === "ERROR") {
        setResults({
          columns: [],
          records: [],
          latency_ms: 0,
          count: 0,
          error: data.error || "Query execution failed",
        });
      } else {
        setResults({
          columns: data.columns || [],
          records: data.records || [],
          latency_ms: data.latency_ms || 0,
          count: data.count || 0,
        });
      }
    } catch (err) {
      setResults({
        columns: [],
        records: [],
        latency_ms: 0,
        count: 0,
        error: String(err),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b1329] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                FalkorDB Cypher Playground
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                  {tenantId}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Execute live OpenCypher queries directly against the FalkorDB knowledge graph
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Preset Queries */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Preset Analytical Queries
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(preset.cypher);
                    handleRunQuery(preset.cypher);
                  }}
                  className="px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/30 text-slate-300 hover:text-cyan-200 transition text-left"
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Cypher Input Editor */}
          <div className="relative rounded-xl border border-slate-800 bg-black/60 overflow-hidden focus-within:border-cyan-500 transition">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 text-[11px] font-mono text-slate-400">
              <span>OpenCypher Statement</span>
              <button
                onClick={copyQuery}
                className="flex items-center gap-1 hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              placeholder="MATCH (n) RETURN n LIMIT 10"
              className="w-full bg-transparent p-3 font-mono text-xs text-cyan-300 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunQuery()}
                disabled={isRunning || !query.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition"
              >
                <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
                <span>{isRunning ? "Executing..." : "Execute Cypher"}</span>
              </button>
            </div>

            {results && (
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <strong className="text-emerald-400">{results.latency_ms.toFixed(2)}ms</strong>
                </span>
                <span>
                  Records: <strong className="text-cyan-300">{results.count}</strong>
                </span>
                <div className="flex border border-slate-800 rounded-lg overflow-hidden text-[11px]">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-2 py-0.5 ${viewMode === "table" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"}`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode("json")}
                    className={`px-2 py-0.5 ${viewMode === "json" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"}`}
                  >
                    JSON
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {results?.error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Cypher Execution Error</strong>
                <span className="font-mono">{results.error}</span>
              </div>
            </div>
          )}

          {/* Results Table / JSON */}
          {results && !results.error && (
            <div className="border border-slate-800 rounded-xl bg-black/40 overflow-hidden">
              {results.records.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  Query executed successfully. 0 records returned.
                </div>
              ) : viewMode === "table" ? (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/80 sticky top-0 border-b border-slate-800">
                      <tr>
                        {results.columns.map((col) => (
                          <th key={col} className="p-2.5 font-bold text-slate-300">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {results.records.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/40 transition">
                          {results.columns.map((col) => {
                            const val = row[col];
                            return (
                              <td key={col} className="p-2.5 text-slate-300 whitespace-nowrap">
                                {typeof val === "object" && val !== null
                                  ? JSON.stringify(val)
                                  : String(val ?? "null")}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="p-4 text-xs font-mono text-cyan-300 max-h-64 overflow-y-auto overflow-x-auto">
                  {JSON.stringify(results.records, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
