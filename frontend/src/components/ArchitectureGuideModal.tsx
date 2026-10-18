"use client";

import React, { useEffect, useRef } from "react";
import { ArrowRight, BookOpen, Brain, FileCode2, X } from "lucide-react";

interface ArchitectureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArchitectureGuideModal({ isOpen, onClose }: ArchitectureGuideModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="guide-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-intro">
        <header className="guide-header">
          <div className="guide-heading"><span className="guide-icon"><BookOpen size={17} /></span><div>
            <p className="guide-eyebrow">WORKSPACE GUIDE</p><h2 id="guide-title">How to use this workspace</h2>
            <p id="guide-intro">Run a prepared trace, ask your own question, or explore the graph directly.</p>
          </div></div>
          <button className="icon-button" onClick={onClose} aria-label="Close guide"><X size={18} /></button>
        </header>

        <div className="guide-body">
          <p className="guide-start-hint">Choose <strong>Billing Core</strong> in the graph selector for the prepared examples. The numbered controls are demonstrations; the message box is for your own questions.</p>
          <section className="guide-section">
            <div className="guide-section-title"><span>01</span><div><h3>Run the prepared demos</h3><p>The numbered buttons are fixed examples. They start immediately and do not open a message box.</p></div></div>
            <ol className="guide-demo-list">
              <li><kbd>01</kbd><div><strong>Recover a dropped payment webhook</strong><span>Records a failed endpoint and its replacement in graph memory.</span></div></li>
              <li><kbd>02</kbd><div><strong>Route around a failed endpoint</strong><span>Run this after 01. A new session reads the saved replacement route.</span></div></li>
              <li><kbd>03</kbd><div><strong>Refactor PaymentRetryWorker</strong><span>Checks a saved decision path and stops the unsafe batching change.</span></div></li>
            </ol>
          </section>

          <section className="guide-section guide-own-question">
            <div className="guide-section-title"><span>02</span><div><h3>Ask your own question</h3><p>Use the message box at the bottom of the Live Feed panel.</p></div></div>
            <div className="guide-flow"><span>Type a question</span><ArrowRight size={14} /><span>Ask agents</span><ArrowRight size={14} /><span>Review graph evidence</span></div>
            <p className="guide-note">For example: <q>Why is batching unsafe for PaymentRetryWorker?</q> The agents answer from the selected graph and its source records. They do not edit your code.</p>
          </section>

          <div className="guide-tool-grid">
            <section className="guide-tool"><Brain size={16} /><div><h3>Company Brain</h3><p>Ask about company knowledge, add local document or ticket exports, and inspect agent memories and handoffs.</p></div></section>
            <section className="guide-tool"><FileCode2 size={16} /><div><h3>Cypher</h3><p>Choose a prepared query or enter your own Cypher. Use a new graph name to build a graph from scratch.</p></div></section>
          </div>
          <p className="guide-shortcuts">Keyboard: <kbd>1</kbd>–<kbd>3</kbd> run demos · <kbd>R</kbd> resets the selected graph · <kbd>?</kbd> opens this guide</p>
        </div>

        <footer className="guide-footer"><span>Start with demo 01, then 02 to see memory carry across runs.</span><button className="primary-action" onClick={onClose}>Got it</button></footer>
      </section>
    </div>
  );
}
