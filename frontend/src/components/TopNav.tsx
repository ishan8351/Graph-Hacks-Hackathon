import React from "react";
import { Database, RotateCcw, Play, ShieldAlert, Sparkles } from "lucide-react";

interface TopNavProps {
  currentTenant: string;
  onTenantChange: (tenant: string) => void;
  onResetGraph: () => void;
  onRunAct1Session1: () => void;
  onRunAct1Session2: () => void;
  onRunAct2Guardrail: () => void;
  isRunning: boolean;
  activeScenario: string | null;
}

export default function TopNav({
  currentTenant,
  onTenantChange,
  onResetGraph,
  onRunAct1Session1,
  onRunAct1Session2,
  onRunAct2Guardrail,
  isRunning,
  activeScenario,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#080d1a]/95 backdrop-blur border-b border-slate-800 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding & Tenant Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Active Engineering Memory Layer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  FalkorDB
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Socio-Technical Graph Memory & Invariant Guardrails</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Tenant Switcher */}
          <div className="flex items-center gap-2">
            <label htmlFor="tenant-select" className="text-xs text-slate-400 font-medium hidden sm:inline">
              Tenant:
            </label>
            <select
              id="tenant-select"
              value={currentTenant}
              onChange={(e) => onTenantChange(e.target.value)}
              disabled={isRunning}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition font-mono"
            >
              <option value="tenant_project_alpha">tenant_project_alpha (Billing Core)</option>
              <option value="tenant_project_beta">tenant_project_beta (Isolated Clean)</option>
            </select>
          </div>
        </div>

        {/* Right: Actions & Scenarios */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Reset & Seed Graph */}
          <button
            onClick={onResetGraph}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
            title="Reset and seed target graph with 44 enterprise nodes"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
            <span>Reset &amp; Seed Graph</span>
          </button>

          {/* Scenario A1 */}
          <button
            onClick={onRunAct1Session1}
            disabled={isRunning}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              activeScenario === "scenario-a1"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/50"
                : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300"
            } disabled:opacity-50`}
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span>Run Act 1: Session 1 (Hit 410 &amp; Write Stigmergy)</span>
          </button>

          {/* Scenario A2 */}
          <button
            onClick={onRunAct1Session2}
            disabled={isRunning}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              activeScenario === "scenario-a2"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/50"
                : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300"
            } disabled:opacity-50`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Act 1: Session 2 (Zero-Shot Self-Healing Route)</span>
          </button>

          {/* Scenario B */}
          <button
            onClick={onRunAct2Guardrail}
            disabled={isRunning}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              activeScenario === "scenario-b"
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 ring-1 ring-rose-500/50"
                : "bg-rose-950/20 border-rose-800/40 hover:border-rose-700 text-rose-200"
            } disabled:opacity-50`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Run Act 2: Refactor PaymentRetryWorker (3-Hop Guardrail)</span>
          </button>

          {/* FalkorDB Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FalkorDB :6379</span>
          </div>
        </div>
      </div>
    </header>
  );
}
