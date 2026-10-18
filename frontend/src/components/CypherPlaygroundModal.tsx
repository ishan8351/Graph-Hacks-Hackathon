"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, X, Terminal, Clock, Copy, Check, Sparkles, AlertCircle, RefreshCw } from "lucide-react";

interface CypherPlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onGraphChanged?: (tenantId: string) => void;
}

const PRESET_QUERIES = [
  { name: "Guardrail path", description: "Follow a decision back to its review comment and owner.", cypher: `MATCH (m:CodeModule)-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(c:VCSComment)<-[:AUTHORED]-(eng:Engineer)\nRETURN m.name AS module, d.id AS decision, j.id AS ticket, c.id AS comment, eng.name AS owner` },
  { name: "Endpoint status", description: "Compare endpoint state and replacement routes.", cypher: `MATCH (e:APIEndpoint)\nOPTIONAL MATCH (e)-[:SUPERSEDED_BY]->(next:APIEndpoint)\nRETURN e.name AS endpoint, coalesce(e.status, 'ACTIVE') AS status, next.name AS superseded_by\nORDER BY status, endpoint` },
  { name: "Engineer connections", description: "Count the graph relationships for each engineer.", cypher: `MATCH (eng:Engineer)-[r]->(target)\nRETURN eng.name AS engineer, eng.role AS role, count(r) AS relationships\nORDER BY relationships DESC` },
  { name: "Operational routes", description: "Inspect modules, routes, and endpoint status.", cypher: `MATCH (m:CodeModule)-[r:EXECUTES_STEP|FALLBACK_STEP]->(api:APIEndpoint)\nRETURN m.name AS module, type(r) AS route, api.name AS endpoint, coalesce(r.status, 'ACTIVE') AS status` },
  { name: "Failure episodes", description: "Review recorded runtime failures.", cypher: `MATCH (f:Failure)\nOPTIONAL MATCH (f)-[:LOGGED_EPISODE]->(m)\nRETURN f.id AS failure, f.error AS error, f.timestamp AS logged_at, m.name AS affected_module` },
];

const STARTER_QUERY = `CREATE (m:CodeModule {name: 'My first module', status: 'ACTIVE'})\nCREATE (api:APIEndpoint {name: '/v1/example', status: 'ACTIVE'})\nCREATE (m)-[:CALLS {status: 'ACTIVE'}]->(api)\nRETURN m, api`;
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type QueryResults = { columns: string[]; records: Record<string, unknown>[]; latency_ms: number; count: number; error?: string };

export default function CypherPlaygroundModal({ isOpen, onClose, tenantId, onGraphChanged }: CypherPlaygroundModalProps) {
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [query, setQuery] = useState(PRESET_QUERIES[0].cypher);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<QueryResults | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [customGraph, setCustomGraph] = useState("my_custom_graph");
  const [activeCustomGraph, setActiveCustomGraph] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const oldOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button, textarea, input")?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onCloseRef.current(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input')];
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => { document.removeEventListener("keydown", handleDialogKeys); document.body.style.overflow = oldOverflow; previouslyFocused?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;

  const handleRunQuery = async (queryToRun = query) => {
    if (!queryToRun.trim()) return;
    setIsRunning(true); setResults(null);
    try {
      const targetGraph = mode === "custom" ? (activeCustomGraph || tenantId) : tenantId;
      const res = await fetch(`${API_BASE}/api/graph/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_id: targetGraph, query: queryToRun }) });
      const data = await res.json();
      if (!res.ok || data.status === "ERROR") throw new Error(data.error || `Request failed (${res.status})`);
      setResults({ columns: data.columns || [], records: data.records || [], latency_ms: data.latency_ms || 0, count: data.count || 0 });
      onGraphChanged?.(targetGraph);
    } catch (err) {
      setResults({ columns: [], records: [], latency_ms: 0, count: 0, error: err instanceof Error ? err.message : String(err) });
    } finally { setIsRunning(false); }
  };

  const choosePreset = (preset: (typeof PRESET_QUERIES)[number]) => { setMode("presets"); setQuery(preset.cypher); setResults(null); };
  const copyQuery = async () => { await navigator.clipboard.writeText(query); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };

  return (
    <div className="product-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="product-modal cypher-modal" role="dialog" aria-modal="true" aria-labelledby="cypher-title">
        <header className="product-modal-header">
          <div className="product-modal-heading"><span className="product-modal-icon"><Terminal size={18} /></span><div><h2 id="cypher-title">Cypher workspace</h2><p>Query and shape the active FalkorDB graph</p></div></div>
          <div className="product-modal-header-side"><span className="tenant-chip">{tenantId}</span><button className="icon-button" onClick={onClose} aria-label="Close Cypher workspace"><X size={18} /></button></div>
        </header>

        <div className="product-modal-body cypher-body">
          <div className="mode-tabs" role="tablist" aria-label="Query workspace mode">
            <button role="tab" aria-selected={mode === "presets"} className={mode === "presets" ? "is-selected" : ""} onClick={() => setMode("presets")}><Sparkles size={14} /> Prepared queries</button>
            <button role="tab" aria-selected={mode === "custom"} className={mode === "custom" ? "is-selected" : ""} onClick={() => { setMode("custom"); if (!query.trim() || PRESET_QUERIES.some((item) => item.cypher === query)) setQuery(""); setResults(null); }}><Terminal size={14} /> Build with Cypher</button>
          </div>

          {mode === "presets" ? <div className="preset-grid" aria-label="Prepared queries">{PRESET_QUERIES.map((preset) => <button key={preset.name} className={`preset-option ${query === preset.cypher ? "is-active" : ""}`} onClick={() => choosePreset(preset)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div> : <>
            <div className="custom-graph-picker"><label htmlFor="custom-graph">Graph to build</label><div><input id="custom-graph" value={customGraph} onChange={(e) => setCustomGraph(e.target.value)} placeholder="e.g. my_custom_graph" pattern="[A-Za-z0-9_-]{1,64}" /><button onClick={() => { const value = customGraph.trim(); if (/^[A-Za-z0-9_-]{1,64}$/.test(value)) { setActiveCustomGraph(value); onGraphChanged?.(value); } }}>Use graph</button></div><small>New names start as empty graphs. Choose a different name to keep your prepared demos separate.</small></div>
            <div className="custom-hint"><strong>Build your graph with Cypher.</strong><span>Type any OpenCypher query, or start from a small example. Successful writes update the canvas for this graph.</span><button onClick={() => { setQuery(STARTER_QUERY); setResults(null); }}>Load graph starter</button></div>
          </>}

          <div className="cypher-editor">
            <div className="editor-toolbar"><label htmlFor="cypher-query">OpenCypher</label><button className="text-button" onClick={copyQuery} disabled={!query}><Copy size={13} />{copied ? "Copied" : "Copy query"}</button></div>
            <textarea id="cypher-query" aria-label="Write an OpenCypher query" value={query} onChange={(e) => setQuery(e.target.value)} rows={mode === "custom" ? 9 : 7} spellCheck={false} placeholder="MATCH (n) RETURN n LIMIT 10" />
            <div className="editor-footer"><span>{mode === "custom" ? (activeCustomGraph ? `Queries run against ${activeCustomGraph}.` : "Choose a graph name above before running a query.") : "Choose a prepared query or edit it before running."}</span><button className="primary-action" onClick={() => handleRunQuery()} disabled={isRunning || !query.trim() || (mode === "custom" && !activeCustomGraph)}><Play size={14} />{isRunning ? "Running query…" : "Run query"}</button></div>
          </div>

          {results && <section className="query-results" aria-live="polite" aria-label="Query results">
            {results.error ? <div className="query-error"><AlertCircle size={17} /><div><strong>Query could not run</strong><p>{results.error}</p><span>Your query is still here so you can correct it and try again.</span></div></div> : <>
              <div className="results-heading"><div><h3>Results</h3><span>{results.count} {results.count === 1 ? "record" : "records"} · {results.latency_ms.toFixed(2)} ms</span></div><div className="result-views"><button className={viewMode === "table" ? "is-selected" : ""} onClick={() => setViewMode("table")}>Table</button><button className={viewMode === "json" ? "is-selected" : ""} onClick={() => setViewMode("json")}>JSON</button></div></div>
              {results.records.length === 0 ? <p className="results-empty">Query completed with no returned records. Graph changes still appear on the canvas.</p> : viewMode === "table" ? <div className="result-table-wrap"><table><thead><tr>{results.columns.map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody>{results.records.map((row, rowIndex) => <tr key={rowIndex}>{results.columns.map((col) => <td key={col}>{typeof row[col] === "object" && row[col] !== null ? JSON.stringify(row[col]) : String(row[col] ?? "null")}</td>)}</tr>)}</tbody></table></div> : <pre className="result-json">{JSON.stringify(results.records, null, 2)}</pre>}
              <p className="canvas-refresh-note"><RefreshCw size={12} /> The graph canvas has been refreshed from {mode === "custom" ? (activeCustomGraph || tenantId) : tenantId}.</p>
            </>}
          </section>}
        </div>
      </section>
    </div>
  );
}
