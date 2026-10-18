"use client";

import React, { useEffect, useRef } from "react";
import { ArrowDown, CheckCircle2, ChevronDown, FileCode2, ShieldAlert, X } from "lucide-react";
import { GuardrailTriggeredEvent } from "../types/events";

interface ExplainDecisionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  guardrailEvent: GuardrailTriggeredEvent | null;
  cypherQuery?: string;
}

export default function ExplainDecisionDrawer({ isOpen, onClose, guardrailEvent, cypherQuery }: ExplainDecisionDrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen || !guardrailEvent) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), summary')];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = oldOverflow; previousFocus?.focus(); };
  }, [isOpen, guardrailEvent]);

  if (!isOpen || !guardrailEvent) return null;
  const defaultCypher = cypherQuery || `MATCH path = (m:CodeModule {name: '${guardrailEvent.module_name}'})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(v:VCSComment)<-[:AUTHORED]-(e:Engineer)\nWHERE d.status = 'SUBOPTIMAL_WORKAROUND'\nRETURN d, j, v, e;`;
  const path = guardrailEvent.path_nodes || [];

  return (
    <div className="refactor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} className="refactor-drawer" role="dialog" aria-modal="true" aria-labelledby="refactor-title">
        <header className="refactor-header"><div className="refactor-title-wrap">
          <span className="refactor-icon"><ShieldAlert size={17} /></span><div><p className="refactor-eyebrow">SAFETY CHECK · {guardrailEvent.module_name}</p>
            <h2 id="refactor-title">Refactor stopped</h2><p className="refactor-subtitle">The graph found evidence that this change could drop partner webhooks.</p>
          </div></div><button className="icon-button" onClick={onClose} aria-label="Close refactor explanation"><X size={18} /></button>
        </header>

        <div className="refactor-body">
          <section className="refactor-outcome"><span className="outcome-mark"><ShieldAlert size={17} /></span><div><strong>Keep the current single-item flow</strong><p>The requested batch change conflicts with a recorded workaround and incident history.</p></div></section>

          <section className="refactor-section"><div className="refactor-section-heading"><div><h3>Evidence path</h3><p>These graph records connect the module to the warning.</p></div><span>{path.length} nodes</span></div>
            {path.length > 0 ? <ol className="refactor-path">{path.map((node, index) => <li key={`${node}-${index}`}><span className="path-index">{String(index + 1).padStart(2, "0")}</span><span className="path-node">{node}</span>{index < path.length - 1 && <ArrowDown className="path-arrow" size={13} />}</li>)}</ol>
              : <p className="refactor-missing">No node sequence was included in the event.</p>}
          </section>

          <section className="refactor-sources"><h3>What the graph returned</h3><dl>
            <div><dt>Decision</dt><dd>{guardrailEvent.decision_id}</dd></div>
            <div><dt>Incident ticket</dt><dd>{guardrailEvent.jira_ticket}</dd></div>
            <div><dt>Review author</dt><dd>{guardrailEvent.engineer_owner}</dd></div>
          </dl></section>

          <blockquote className="refactor-quote"><span>REVIEW WARNING</span><p>“{guardrailEvent.vcs_comment}”</p></blockquote>

          <details className="refactor-query"><summary><FileCode2 size={14} />Show the Cypher used to trace the decision<ChevronDown size={14} /></summary><pre>{defaultCypher}</pre></details>

          <div className="refactor-resolution"><CheckCircle2 size={16} /><span>The guardrail preserved the existing flow. Review the cited decision and incident before changing it.</span></div>
        </div>
        <footer className="refactor-footer"><span>Evidence is from the selected graph.</span><button className="secondary-action" onClick={onClose}>Close</button></footer>
      </aside>
    </div>
  );
}
