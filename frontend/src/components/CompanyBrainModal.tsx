"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, FilePlus2, Brain, Send, Search, X, Link2, Clock3, CheckCircle2, AlertCircle, Play, Radio } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type BrainAnswer = { answer: string; grounded: boolean; answer_mode?: string; llm_note?: string | null; citations: Array<{ source_id: string; source_type: string; title: string; url?: string; excerpt?: string; updated_at?: string }>; evidence_paths: Array<{ from: string; to: string; relation: string }> };
type MemoryRecord = { id: string; memory_type: string; content: string; agent_id: string; created_at: string; conversation_id?: string; source_id?: string; confidence?: number };
type Handoff = { id: string; version: number; status: string; from_agent: string; to_agent: string; task: string; payload: Record<string, unknown> };
type RunEvent = { event_type: string; agent_name?: string; thought?: string; action?: string; tool_name?: string; arguments?: Record<string, unknown>; final_summary?: string; status?: string };

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}

function normalizeLocalRecords(fileName: string, text: string, fallbackType: string): Array<Record<string, unknown>> {
  const extension = fileName.split(".").pop()?.toLowerCase();
  let entries: Array<Record<string, unknown>>;
  if (extension === "csv") entries = parseCsv(text);
  else if (extension === "json") {
    const parsed = JSON.parse(text);
    const collection = ["records", "tickets", "issues", "documents", "items"].find((key) => Array.isArray(parsed?.[key]));
    entries = Array.isArray(parsed) ? parsed : collection ? parsed[collection] : [parsed];
  } else entries = [{ title: fileName, content: text }];
  return entries.map((entry, index) => {
    const fields = entry.fields && typeof entry.fields === "object" ? entry.fields as Record<string, unknown> : {};
    const content = entry.content ?? entry.body ?? entry.description ?? fields.description ?? entry.text ?? entry.summary ?? fields.summary;
    const title = entry.title ?? entry.subject ?? entry.name ?? fields.summary ?? `${fileName} · ${index + 1}`;
    const id = entry.source_id ?? entry.key ?? entry.id ?? `${fileName}:${index + 1}`;
    const looksLikeTicket = Boolean(entry.issuetype || entry.issue_type || entry.ticket_id || entry.key && (entry.summary || fields.summary));
    const rawType = String(entry.source_type ?? entry.type ?? (looksLikeTicket ? "TICKET" : fallbackType)).toUpperCase();
    const sourceType = rawType.includes("TICKET") || rawType.includes("ISSUE") ? "TICKET" : rawType === "CHAT" ? "CHAT" : "DOCUMENT";
    return { tenant_id: "", user_id: "demo_user", source_type: sourceType, source_id: String(id),
      title: String(title), content: typeof content === "string" ? content : JSON.stringify(content ?? ""),
      source_url: entry.source_url ?? entry.url ?? entry.html_url ?? null,
      entities: Array.isArray(entry.entities) ? entry.entities : [],
      relationships: Array.isArray(entry.relationships) ? entry.relationships : [] };
  }).filter((entry) => String(entry.content).trim().length > 0);
}

interface Props { isOpen: boolean; onClose: () => void; tenantId: string; onGraphChanged?: () => void; }

export default function CompanyBrainModal({ isOpen, onClose, tenantId, onGraphChanged }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [tab, setTab] = useState<"ask" | "source" | "memory">("ask");
  const [question, setQuestion] = useState("Who owns PaymentRetryWorker, and why is batching unsafe?");
  const [answer, setAnswer] = useState<BrainAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceType, setSourceType] = useState("DOCUMENT");
  const [sourceId, setSourceId] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [entityText, setEntityText] = useState("");
  const [relationshipText, setRelationshipText] = useState("");
  const [notice, setNotice] = useState("");
  const [memoryType, setMemoryType] = useState("EPISODIC");
  const [memoryConfidence, setMemoryConfidence] = useState("1");
  const [memorySourceId, setMemorySourceId] = useState("");
  const [memoryContent, setMemoryContent] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [conversationTurns, setConversationTurns] = useState<MemoryRecord[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [handoffRunning, setHandoffRunning] = useState(false);
  const [task, setTask] = useState("");
  const [fromAgent, setFromAgent] = useState("investigation-agent");
  const [toAgent, setToAgent] = useState("implementation-agent");
  const [handoffPayload, setHandoffPayload] = useState('{\n  "findings": [],\n  "next_steps": []\n}');

  useEffect(() => {
    if (!isOpen) return;
    const oldOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onCloseRef.current(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, select')];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = oldOverflow; previouslyFocused?.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  const request = async (path: string, options?: RequestInit) => {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || `Request failed (${response.status})`);
    return data;
  };
  const post = (path: string, body: unknown) => request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const ask = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setAnswer(null);
    try { setAnswer(await post("/api/company/ask", { tenant_id: tenantId, question })); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const runAgentHandoff = () => {
    if (handoffRunning || question.trim().length < 3) return;
    setRunEvents([]); setError(""); setAnswer(null); setHandoffRunning(true);
    const params = new URLSearchParams({ tenant_id: tenantId, user_id: "demo_user", question });
    const stream = new EventSource(`${API_BASE}/api/stream/agent-handoff?${params.toString()}`);
    const accept = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as RunEvent;
        setRunEvents((current) => [...current, data]);
        if (data.event_type === "SESSION_COMPLETE") {
          stream.close(); setHandoffRunning(false); void loadAgentState(); onGraphChanged?.();
          if (data.status !== "SUCCESS") {
            setError(data.final_summary || "The two-agent workflow could not finish. Review its event log and try again.");
            return;
          }
          // The completed handoff carries the same cited answer shown in the memory panel.
          void request(`/api/memory/handoffs?tenant_id=${encodeURIComponent(tenantId)}&user_id=demo_user&limit=10`)
            .then((result) => {
              const match = (result.handoffs as Handoff[]).find((item) => item.from_agent === "ContextAgent" && item.to_agent === "ResearchAgent" && item.status === "COMPLETED");
              if (match) setAnswer({ answer: String(match.payload.result || "Agent handoff completed."), grounded: Array.isArray(match.payload.citations) && match.payload.citations.length > 0,
                citations: (match.payload.citations as BrainAnswer["citations"]) || [], evidence_paths: (match.payload.evidence_paths as BrainAnswer["evidence_paths"]) || [], answer_mode: String(match.payload.answer_mode || "graph") });
            }).catch(() => undefined);
        }
      } catch { /* Ignore malformed partial stream frames. */ }
    };
    ["AGENT_STEP", "MCP_TOOL_CALL", "SESSION_COMPLETE"].forEach((eventName) => stream.addEventListener(eventName, accept as EventListener));
    stream.onerror = () => { stream.close(); setHandoffRunning(false); setError("The two-agent run was interrupted. Check the backend connection and try again."); };
  };

  const importLocalFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    setBusy(true); setError(""); setNotice("");
    let saved = 0;
    try {
      for (const file of files) {
        const records = normalizeLocalRecords(file.name, await file.text(), sourceType);
        for (const record of records) {
          if (String(record.content).length > 30000) throw new Error(`${String(record.title)} exceeds the 30,000 character source limit.`);
          await post("/api/company/sources", { ...record, tenant_id: tenantId });
          saved += 1;
        }
      }
      setNotice(`Imported ${saved} local source${saved === 1 ? "" : "s"} into this tenant graph.`);
      onGraphChanged?.();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); event.target.value = ""; }
  };

  const ingest = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const entities = entityText.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
      const [name, type = "concept"] = item.split(":").map((part) => part.trim());
      return { name, entity_type: type, description: "", relation: "mentions" };
    });
    const relationships = relationshipText.split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
      const [source_name, source_type, relation, target_name, target_type] = item.split("|").map((part) => part.trim());
      return { source_name, source_type, relation, target_name, target_type };
    });
    try {
      const data = await post("/api/company/sources", { tenant_id: tenantId, user_id: "demo_user", source_type: sourceType, source_id: sourceId, title: sourceTitle, content: sourceContent, source_url: sourceUrl || null, entities, relationships });
      setNotice(`Saved ${sourceType.toLowerCase()} ${sourceId}; linked ${data.entities_linked} entities and ${data.relationships_upserted} relationships (version ${data.version}).`);
      onGraphChanged?.();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const loadAgentState = async () => {
    setBusy(true); setError("");
    try {
      const [memoryData, handoffData] = await Promise.all([
        request(`/api/memory/records?tenant_id=${encodeURIComponent(tenantId)}&user_id=demo_user&limit=30`),
        request(`/api/memory/handoffs?tenant_id=${encodeURIComponent(tenantId)}&user_id=demo_user&limit=30`),
      ]);
      setMemories(memoryData.records || []); setHandoffs(handoffData.handoffs || []);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const loadConversation = async () => {
    if (!conversationId.trim()) return;
    setBusy(true); setError("");
    try {
      const data = await request(`/api/memory/conversations/${encodeURIComponent(conversationId)}?tenant_id=${encodeURIComponent(tenantId)}&user_id=demo_user`);
      setConversationTurns(data.messages || []);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };

  const saveMemory = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await post("/api/memory/records", { tenant_id: tenantId, user_id: "demo_user", memory_type: memoryType, content: memoryContent, agent_id: fromAgent, idempotency_key: crypto.randomUUID(), conversation_id: conversationId || null, source_id: memorySourceId || null, confidence: Number(memoryConfidence) });
      setMemoryContent(""); setNotice("Memory saved to the shared tenant graph."); await loadAgentState();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };

  const createHandoff = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await post("/api/memory/handoffs", { tenant_id: tenantId, user_id: "demo_user", from_agent: fromAgent, to_agent: toAgent, task, payload: JSON.parse(handoffPayload), idempotency_key: crypto.randomUUID() });
      setTask(""); setNotice(`Handoff created for ${toAgent}.`); await loadAgentState();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };

  const updateHandoff = async (handoff: Handoff, status: string) => {
    setBusy(true); setError("");
    try {
      await request(`/api/memory/handoffs/${encodeURIComponent(handoff.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_id: tenantId, user_id: "demo_user", expected_version: handoff.version, status }) });
      await loadAgentState();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };

  return <div className="product-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="product-modal brain-modal" role="dialog" aria-modal="true" aria-labelledby="brain-title">
      <header className="product-modal-header"><div className="product-modal-heading"><span className="product-modal-icon"><BookOpen size={18} /></span><div><h2 id="brain-title">Company Brain</h2><p>Ask across connected company knowledge and agent memory</p></div></div><div className="product-modal-header-side"><span className="tenant-chip">{tenantId}</span><button className="icon-button" onClick={onClose} aria-label="Close Company Brain"><X size={18} /></button></div></header>
      <nav className="brain-tabs" aria-label="Company Brain tools">
        <button className={tab === "ask" ? "is-selected" : ""} onClick={() => setTab("ask")}><Search size={14} />Ask company</button>
        <button className={tab === "source" ? "is-selected" : ""} onClick={() => setTab("source")}><FilePlus2 size={14} />Add source</button>
        <button className={tab === "memory" ? "is-selected" : ""} onClick={() => { setTab("memory"); void loadAgentState(); }}><Brain size={14} />Agent memory & handoffs</button>
      </nav>
      <div className="product-modal-body brain-body">
        {tab === "ask" && <>
          <form className="brain-question-form" onSubmit={ask}><label htmlFor="brain-question">Ask about people, projects, decisions, or operational knowledge</label><textarea id="brain-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} placeholder="Who owns this project, and what decisions constrain it?" /><div className="brain-action-row"><button className="primary-action" disabled={busy || handoffRunning || question.trim().length < 3}><Send size={14} />{busy ? "Searching graph…" : "Ask the graph"}</button><button type="button" className="secondary-action" disabled={busy || handoffRunning || question.trim().length < 3} onClick={runAgentHandoff}><Play size={14} />{handoffRunning ? "Agents working…" : "Run two-agent handoff"}</button></div></form>
          {runEvents.length > 0 && <section className="handoff-run-feed" aria-live="polite"><div className="brain-list-heading"><h3>Agent handoff run</h3><span className="source-kind">{handoffRunning ? <><Radio size={11} /> LIVE</> : "COMPLETE"}</span></div>{runEvents.map((item, index) => <article className="handoff-run-event" key={`${item.event_type}-${index}`}><span className="run-event-kind">{item.event_type === "AGENT_STEP" ? item.agent_name : item.event_type === "MCP_TOOL_CALL" ? "GRAPH TOOL" : "RUN STATUS"}</span><p>{item.thought || (item.event_type === "MCP_TOOL_CALL" ? `${item.tool_name} · ${Object.entries(item.arguments || {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}` : item.final_summary || item.status)}</p></article>)}</section>}
          {answer && <div className="brain-answer" aria-live="polite"><div className="brain-answer-title"><h3>Answer from {answer.citations.length} source{answer.citations.length === 1 ? "" : "s"}</h3><span className={answer.grounded ? "evidence-grounded" : "evidence-missing"}>{answer.grounded ? <><CheckCircle2 size={13} /> Evidence found</> : <><AlertCircle size={13} /> No supporting evidence</>}</span></div>{answer.answer_mode && <small className="answer-mode">{answer.answer_mode === "gemini" ? "Gemini · graph-grounded" : "Graph retrieval"}</small>}<p className="answer-copy">{answer.answer}</p>{answer.llm_note && <p className="brain-help">{answer.llm_note}</p>}
            {answer.evidence_paths.length > 0 && <div className="evidence-paths"><h4>Graph evidence paths</h4>{answer.evidence_paths.slice(0, 8).map((path, index) => <div key={`${path.from}-${path.relation}-${path.to}-${index}`}><span>{path.from}</span><b>{path.relation}</b><span>{path.to}</span></div>)}</div>}
            <div className="citation-list"><h4>Sources</h4>{answer.citations.length ? answer.citations.map((citation, index) => <article className="citation-item" key={`${citation.source_id}-${index}`}><div><span className="source-kind">{citation.source_type}</span><strong>{citation.title}</strong><code>{citation.source_id}</code></div>{citation.url && <a href={citation.url} target="_blank" rel="noreferrer">Open source <Link2 size={12} /></a>}{citation.excerpt && <p>{citation.excerpt}</p>}{citation.updated_at && <small><Clock3 size={11} /> Updated {citation.updated_at}</small>}</article>) : <p className="brain-help">No source citation matched. Add a document, ticket, or chat excerpt and try again.</p>}</div>
          </div>}
          {!answer && !busy && <div className="brain-empty"><strong>Search connected evidence, not just keywords.</strong><span>Answers show the graph path and the source records behind each finding. Start with PaymentRetryWorker in the seeded Billing Core graph.</span></div>}
        </>}

        {tab === "source" && <div className="local-import-card"><div><strong>Import local documents or ticket exports</strong><span>Choose .txt, .md, .json, or .csv files. Files are read in your browser and saved to this graph.</span></div><label className="local-import-control"><span>Choose files</span><input type="file" accept=".txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv" multiple disabled={busy} onChange={(event) => void importLocalFiles(event)} /><small>CSV/JSON rows should include content, description, body, or text. Optional columns: id, title, type, url. No external service is contacted.</small></label></div>}
        {tab === "source" && <form className="brain-form" onSubmit={ingest}><div className="brain-form-intro"><strong>Add one source manually.</strong><span>Use a stable source ID. Sending the same ID again updates that record instead of making a duplicate.</span></div><div className="brain-form-grid"><label>Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="DOCUMENT">Document</option><option value="TICKET">Ticket</option><option value="CHAT">Chat excerpt</option></select></label><label>Source ID<input required value={sourceId} onChange={(event) => setSourceId(event.target.value)} placeholder="ADR-042 or doc-architecture" /></label></div><label>Title<input required value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Why PaymentRetryWorker stays synchronous" /></label><label>Source URL (optional)<input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></label><label>Content<textarea required rows={5} value={sourceContent} onChange={(event) => setSourceContent(event.target.value)} placeholder="Paste the relevant decision, ticket, document, or chat text." /></label><label>Entities to connect<input value={entityText} onChange={(event) => setEntityText(event.target.value)} placeholder="PaymentRetryWorker:module, Aarav:person, Payments Core:team" /><small>Comma-separated `name:type` values connect the source to people, teams, projects, and decisions.</small></label><label>Relationships (optional)<textarea rows={2} value={relationshipText} onChange={(event) => setRelationshipText(event.target.value)} placeholder="Aarav|person|OWNS|PaymentRetryWorker|module" /><small>Separate with semicolons. Format: `person name|type|RELATION|target name|type`.</small></label><button className="primary-action" disabled={busy || !sourceId || !sourceTitle || !sourceContent}><FilePlus2 size={14} />{busy ? "Saving source…" : "Save to graph"}</button></form>}

        {tab === "memory" && <div className="agent-memory-layout"><section className="memory-compose"><div className="brain-form-intro"><strong>Write memory another agent can recall.</strong><span>Records are scoped by tenant and user. Use a conversation ID to persist a conversation turn.</span></div><form className="brain-form" onSubmit={saveMemory}><div className="brain-form-grid"><label>Memory type<select value={memoryType} onChange={(event) => setMemoryType(event.target.value)}><option value="EPISODIC">Episodic · what happened</option><option value="SEMANTIC">Semantic · what is true</option><option value="PROCEDURAL">Procedural · how to do it</option></select></label><label>Conversation ID (optional)<input value={conversationId} onChange={(event) => setConversationId(event.target.value)} placeholder="incident-review-2026-10" /></label></div><div className="brain-form-grid"><label>Source ID (optional)<input value={memorySourceId} onChange={(event) => setMemorySourceId(event.target.value)} placeholder="PAY-409 or ADR-019" /></label><label>Confidence<select value={memoryConfidence} onChange={(event) => setMemoryConfidence(event.target.value)}><option value="1">High · 1.0</option><option value="0.8">Medium · 0.8</option><option value="0.5">Tentative · 0.5</option></select></label></div><label>Memory content<textarea required rows={3} value={memoryContent} onChange={(event) => setMemoryContent(event.target.value)} placeholder="Record a finding, fact, or reusable procedure." /></label><button className="primary-action" disabled={busy || !memoryContent.trim()}><Brain size={14} />Save memory</button></form>
            {conversationId && <section className="conversation-history"><div className="brain-list-heading"><h3>Conversation history</h3><button className="text-button" disabled={busy} onClick={() => void loadConversation()}><Clock3 size={13} />Load turns</button></div>{conversationTurns.map((turn) => <article className="memory-row" key={turn.id}><span className="source-kind">{turn.agent_id}</span><p>{turn.content}</p><small>{turn.created_at}</small></article>)}</section>}
            <div className="handoff-compose"><h3>Hand work to another agent</h3><form className="brain-form" onSubmit={createHandoff}><label>Task<input required value={task} onChange={(event) => setTask(event.target.value)} placeholder="Verify the payment retry constraint" /></label><div className="brain-form-grid"><label>From agent<input value={fromAgent} onChange={(event) => setFromAgent(event.target.value)} /></label><label>To agent<input value={toAgent} onChange={(event) => setToAgent(event.target.value)} /></label></div><label>Shared state (JSON)<textarea rows={3} value={handoffPayload} onChange={(event) => setHandoffPayload(event.target.value)} /></label><button className="secondary-action" disabled={busy || !task.trim()}><Send size={13} />Create handoff</button></form></div>
          </section><section className="memory-lists"><div className="brain-list-heading"><h3>Recent memories</h3><button className="text-button" onClick={() => void loadAgentState()}><Clock3 size={13} />Refresh</button></div>{memories.length ? memories.map((memory) => <article className="memory-row" key={memory.id}><span className="source-kind">{memory.memory_type}</span><p>{memory.content}</p><small>{memory.agent_id} · {memory.created_at} · confidence {memory.confidence ?? 1}{memory.source_id ? ` · source ${memory.source_id}` : ""}</small></article>) : <p className="brain-help">No memories saved for this user and tenant yet.</p>}
            <div className="brain-list-heading"><h3>Agent handoffs</h3></div>{handoffs.length ? handoffs.map((handoff) => <article className="handoff-row" key={handoff.id}><div><strong>{handoff.task}</strong><small>{handoff.from_agent} → {handoff.to_agent} · v{handoff.version} · {handoff.status}</small><pre>{JSON.stringify(handoff.payload, null, 2)}</pre></div>{handoff.status === "OPEN" && <button className="text-button" disabled={busy} onClick={() => void updateHandoff(handoff, "CLAIMED")}>Claim</button>}{handoff.status === "CLAIMED" && <button className="text-button" disabled={busy} onClick={() => void updateHandoff(handoff, "COMPLETED")}>Complete</button>}</article>) : <p className="brain-help">No handoffs yet. Create one to give another agent durable task context.</p>}</section></div>}
        {error && <div className="brain-error" role="alert"><AlertCircle size={15} />{error}</div>}{notice && <div className="brain-notice" role="status"><CheckCircle2 size={15} />{notice}</div>}
      </div>
    </section>
  </div>;
}
