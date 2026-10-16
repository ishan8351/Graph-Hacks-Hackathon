import React from "react";
import { X, ShieldAlert, Award, FileCode, CheckCircle, ArrowRight } from "lucide-react";
import { GuardrailTriggeredEvent } from "../types/events";

interface ExplainDecisionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  guardrailEvent: GuardrailTriggeredEvent | null;
  cypherQuery?: string;
}

export default function ExplainDecisionDrawer({
  isOpen,
  onClose,
  guardrailEvent,
  cypherQuery,
}: ExplainDecisionDrawerProps) {
  if (!isOpen || !guardrailEvent) return null;

  const defaultCypher =
    cypherQuery ||
    `MATCH path = (m:CodeModule {name: '${guardrailEvent.module_name}'})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(v:VCSComment)<-[:AUTHORED]-(e:Engineer)
WHERE d.status = 'SUBOPTIMAL_WORKAROUND'
RETURN d.id AS decision_id, j.id AS jira_id, v.text AS vcs_warning, e.name AS engineer_owner;`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#0d131f] border-l border-amber-500/30 shadow-2xl z-50 flex flex-col overflow-hidden text-slate-200 animate-in slide-in-from-right duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-amber-300">Active Engineering Guardrail Triggered</h2>
            <p className="text-xs text-slate-400">Visual Explainability & Invariant Trace</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Explain Decision Path"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Warning Banner */}
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/30 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <span>Destructive Refactor Aborted</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The multi-agent swarm attempted to upgrade <span className="font-mono text-cyan-400">{guardrailEvent.module_name}</span> to batch endpoints.
            FalkorDB graph traversal detected a governing invariant protecting against catastrophic partner webhook drops.
          </p>
        </div>

        {/* 3-Hop Invariant Visual Chain */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            3-Hop Traversal Chain
          </h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-xs font-medium text-slate-300">CodeModule:</span>
              <span className="text-xs font-mono text-cyan-300 ml-auto">{guardrailEvent.module_name}</span>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-4 h-4 rotate-90" />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span className="text-xs font-medium text-slate-300">Governing ADR:</span>
              <span className="text-xs font-mono text-purple-300 ml-auto font-bold">{guardrailEvent.decision_id}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">SUBOPTIMAL_WORKAROUND</span>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-4 h-4 rotate-90" />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-xs font-medium text-slate-300">Incident Jira Ticket:</span>
              <span className="text-xs font-mono text-amber-300 ml-auto font-bold">{guardrailEvent.jira_ticket}</span>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-4 h-4 rotate-90" />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span className="text-xs font-medium text-slate-300">Historic Code Review:</span>
              <span className="text-xs font-mono text-rose-300 ml-auto font-bold">pr_882_c4</span>
            </div>

            <div className="flex justify-center text-slate-600">
              <ArrowRight className="w-4 h-4 rotate-90" />
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-medium text-slate-300">Authoring Architect:</span>
              <span className="text-xs font-mono text-emerald-300 ml-auto font-bold">{guardrailEvent.engineer_owner}</span>
            </div>
          </div>
        </div>

        {/* Historic VCS Comment Warning */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Historic Code Review Warning (pr_882_c4)
          </h3>
          <blockquote className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs italic text-rose-200/90 leading-relaxed font-sans">
            "{guardrailEvent.vcs_comment}"
          </blockquote>
        </div>

        {/* Domain Expert Profile */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Domain Expert (Centrality Rank #1)
          </h3>
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {guardrailEvent.engineer_owner.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">{guardrailEvent.engineer_owner}</span>
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  <Award className="w-3 h-3" /> Staff Architect
                </span>
              </div>
              <p className="text-xs text-slate-400">aarav@enterprise.internal &bull; Payments Core</p>
            </div>
            <div className="ml-auto text-right">
              <span className="text-xs font-bold text-cyan-400">Centrality: High</span>
              <p className="text-[10px] text-slate-500">Degree: 14 edges</p>
            </div>
          </div>
        </div>

        {/* Cypher Query Verification */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Executed FalkorDB Cypher Traversal
            </h3>
          </div>
          <pre className="p-3.5 rounded-xl bg-black/60 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {defaultCypher}
          </pre>
        </div>

        {/* Safe Outcome */}
        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>Single-item polling loop preserved. Outage prevented with zero developer intervention.</span>
        </div>
      </div>
    </div>
  );
}
