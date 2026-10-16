"use client";

import React from "react";
import { BookOpen, X, Shield, GitBranch, Zap, Database, ArrowRight } from "lucide-react";

interface ArchitectureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArchitectureGuideModal({
  isOpen,
  onClose,
}: ArchitectureGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b1329] border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Active Engineering Memory Layer — Architecture Guide
              </h2>
              <p className="text-xs text-slate-400">
                Socio-Technical Graph Memory, Dynamic Guardrails &amp; Stigmergic Self-Healing
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 leading-relaxed">
          {/* Section 1: The Problem & Vision */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" />
              1. The Fundamental Problem: Blind AI Swarms
            </h3>
            <p>
              Autonomous developer agents operate with static system prompts and zero historical context.
              When an enterprise API is deprecated, agents repeatedly make the same failing HTTP calls.
              More critically, when refactoring code, agents unknowingly remove subtle workarounds that were
              put in place years ago to prevent catastrophic partner-bank outages.
            </p>
          </div>

          {/* Section 2: Core Graph Mechanisms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pattern A: Graph Stigmergy */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h4>Graph Stigmergy (Act 1)</h4>
              </div>
              <p className="text-slate-400">
                When an agent encounters an HTTP 410 Gone, it executes an atomic graph mutation in FalkorDB:
              </p>
              <div className="p-2 rounded-lg bg-black/60 border border-slate-800 font-mono text-[11px] text-emerald-300">
                (Failure)-[:LOGGED_EPISODE]-&gt;(ep:APIEndpoint)<br />
                SET ep.status = 'DEPRECATED'<br />
                CREATE (ep)-[:SUPERSEDED_BY]-&gt;(newEp)
              </div>
              <p className="text-slate-400">
                Subsequent agents in brand-new sessions inherit this provenance zero-shot and route directly to the replacement API.
              </p>
            </div>

            {/* Pattern B: 3-Hop Invariant Guardrail */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Shield className="w-4 h-4 text-amber-400" />
                <h4>3-Hop Guardrail (Act 2)</h4>
              </div>
              <p className="text-slate-400">
                Before refactoring <code className="text-purple-300">PaymentRetryWorker</code>, the agent traverses:
              </p>
              <div className="p-2 rounded-lg bg-black/60 border border-slate-800 font-mono text-[11px] text-amber-300">
                (Worker)-[:IMPLEMENTS]-&gt;(ADR-019)<br />
                -[:FORCED_BY]-&gt;(PAY-409)<br />
                -[:EXPLAINED_IN]-&gt;(pr_882_c4)<br />
                &lt;-[:AUTHORED]-(Aarav)
              </div>
              <p className="text-slate-400">
                The warning from Staff Architect Aarav blocks the destructive batch refactor and surfaces full provenance to the human.
              </p>
            </div>
          </div>

          {/* Section 3: Keyboard Shortcuts */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <h4 className="font-bold text-slate-200 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-400" />
              Keyboard Shortcuts for Live Demos
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold">1</kbd>
                <div className="text-slate-400 text-[10px] mt-1">Act 1: Session 1</div>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold">2</kbd>
                <div className="text-slate-400 text-[10px] mt-1">Act 1: Session 2</div>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 text-rose-400 font-bold">3</kbd>
                <div className="text-slate-400 text-[10px] mt-1">Act 2: Guardrail</div>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">R</kbd>
                <div className="text-slate-400 text-[10px] mt-1">Reset &amp; Seed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/60">
          <span className="text-[11px] text-slate-400">
            Powered by FalkorDB graph engine, FastMCP protocol &amp; LangGraph swarms
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
