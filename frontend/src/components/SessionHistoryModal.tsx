"use client";

import React, { useEffect, useRef } from "react";
import { History, X, Trash2, ArrowRight, CheckCircle2, ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import { MemoryLayerEvent } from "../types/events";

export interface SessionRecord {
  id: string; scenarioName: string; scenarioId: string; tenant: string; timestamp: string;
  eventCount: number; status: string; events: MemoryLayerEvent[];
}
interface SessionHistoryModalProps {
  isOpen: boolean; onClose: () => void; sessions: SessionRecord[];
  onSelectSession: (session: SessionRecord) => void; onClearHistory: () => void;
}

export default function SessionHistoryModal({ isOpen, onClose, sessions, onSelectSession, onClearHistory }: SessionHistoryModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const oldOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onCloseRef.current(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleDialogKeys);
    return () => { document.removeEventListener("keydown", handleDialogKeys); document.body.style.overflow = oldOverflow; previouslyFocused?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  const statusInfo = (status: string) => status === "BLOCKED_BY_GUARDRAIL"
    ? { text: "Guardrail stopped run", icon: ShieldAlert, kind: "warning" }
    : status === "SUCCESS" ? { text: "Completed", icon: CheckCircle2, kind: "success" }
      : { text: status.replaceAll("_", " "), icon: AlertTriangle, kind: "error" };

  return <div className="product-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="product-modal runs-modal" role="dialog" aria-modal="true" aria-labelledby="runs-title">
      <header className="product-modal-header">
        <div className="product-modal-heading"><span className="product-modal-icon"><History size={18} /></span><div><h2 id="runs-title">Run history</h2><p>Review agent runs and reopen their event traces</p></div></div>
        <div className="product-modal-header-side"><span className="tenant-chip">{sessions.length} saved</span><button className="icon-button" onClick={onClose} aria-label="Close run history"><X size={18} /></button></div>
      </header>
      <div className="product-modal-body runs-body">
        {sessions.length === 0 ? <div className="runs-empty"><span className="product-modal-icon"><History size={18} /></span><h3>No runs saved yet</h3><p>Choose one of the three prepared traces in the top bar. Each finished run will appear here with its status, event count, and timeline.</p><button className="secondary-action" onClick={onClose}>Back to workspace</button></div> : <ol className="run-list">{sessions.map((session) => {
          const state = statusInfo(session.status); const Icon = state.icon;
          return <li className="run-item" key={session.id}>
            <div className="run-item-top"><div><h3>{session.scenarioName}</h3><p className="run-meta"><span><Clock size={13} />{new Date(session.timestamp).toLocaleString()}</span><span>{session.tenant}</span><span>{session.eventCount} events</span></p></div><span className={`run-status is-${state.kind}`}><Icon size={14} />{state.text}</span></div>
            <div className="run-item-bottom"><span>Saved on this device</span><button className="text-button" onClick={() => { onSelectSession(session); onClose(); }}>Inspect events <ArrowRight size={14} /></button></div>
          </li>;
        })}</ol>}
      </div>
      {sessions.length > 0 && <footer className="product-modal-footer"><span>History is stored in this browser (up to 20 runs).</span><button className="danger-text-button" onClick={onClearHistory}><Trash2 size={14} />Clear history</button></footer>}
    </section>
  </div>;
}
