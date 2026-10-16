"use client";

import React, { useState } from "react";
import {
  Database,
  RotateCcw,
  Play,
  ShieldAlert,
  Sparkles,
  Terminal,
  History,
  BookOpen,
  Menu,
  X,
  Radio,
} from "lucide-react";

interface TopNavProps {
  currentTenant: string;
  onTenantChange: (tenant: string) => void;
  onResetGraph: () => void;
  onRunAct1Session1: () => void;
  onRunAct1Session2: () => void;
  onRunAct2Guardrail: () => void;
  isRunning: boolean;
  activeScenario: string | null;
  connectionStatus?: "connected" | "connecting" | "disconnected" | "idle" | "live";
  onOpenPlayground?: () => void;
  onOpenHistory?: () => void;
  onOpenGuide?: () => void;
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
  connectionStatus = "connected",
  onOpenPlayground,
  onOpenHistory,
  onOpenGuide,
}: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const getStatusPill = () => {
    if (activeScenario || connectionStatus === "live") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>LIVE STREAM</span>
        </div>
      );
    }
    if (connectionStatus === "connecting") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-[11px] font-mono text-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>CONNECTING...</span>
        </div>
      );
    }
    if (connectionStatus === "disconnected") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-[11px] font-mono text-rose-300">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>DISCONNECTED</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span>FalkorDB :6379</span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-[#080d1a]/95 backdrop-blur border-b border-slate-800 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Branding & Tenant Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Active Engineering Memory Layer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  FalkorDB
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Socio-Technical Graph Memory &amp; Invariant Guardrails
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          {/* Tenant Switcher */}
          <div className="hidden sm:flex items-center gap-1.5">
            <label htmlFor="tenant-select" className="text-xs text-slate-400 font-medium">
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
              <option value="tenant_project_beta">tenant_project_beta (Logistics &amp; Carriers)</option>
            </select>
          </div>
        </div>

        {/* Right Desktop: Actions & Scenarios */}
        <div className="hidden xl:flex items-center gap-2">
          {/* Reset & Seed Graph */}
          <button
            onClick={onResetGraph}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
            title="Reset and seed target graph [R]"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
            <span>Reset &amp; Seed Graph</span>
            <kbd className="text-[9px] px-1 rounded bg-slate-900 text-slate-400">R</kbd>
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
            title="Run Act 1: Session 1 [1]"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span>Run Act 1: Session 1</span>
            <kbd className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">1</kbd>
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
            title="Run Act 1: Session 2 [2]"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Act 1: Session 2</span>
            <kbd className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">2</kbd>
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
            title="Run Act 2: 3-Hop Guardrail [3]"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Run Act 2: Refactor PaymentRetryWorker</span>
            <kbd className="text-[9px] px-1 rounded bg-rose-950 text-rose-300">3</kbd>
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Utility Tools */}
          {onOpenPlayground && (
            <button
              onClick={onOpenPlayground}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title="Open Cypher Playground"
            >
              <Terminal className="w-4 h-4" />
            </button>
          )}

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-300 transition"
              title="Session History"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 transition"
              title="Architecture Guide & Keybindings"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}

          {/* Status Pill */}
          {getStatusPill()}
        </div>

        {/* Mobile / Tablet Actions Button */}
        <div className="flex xl:hidden items-center gap-2">
          {getStatusPill()}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden mt-3 pt-3 border-t border-slate-800 space-y-2.5 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-400">Target Tenant:</span>
            <select
              value={currentTenant}
              onChange={(e) => onTenantChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono"
            >
              <option value="tenant_project_alpha">tenant_project_alpha</option>
              <option value="tenant_project_beta">tenant_project_beta</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => {
                onResetGraph();
                setMobileMenuOpen(false);
              }}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset &amp; Seed Graph</span>
            </button>

            <button
              onClick={() => {
                onRunAct1Session1();
                setMobileMenuOpen(false);
              }}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-800 text-xs font-semibold text-amber-200"
            >
              <Play className="w-4 h-4 text-amber-400" />
              <span>Act 1: Session 1</span>
            </button>

            <button
              onClick={() => {
                onRunAct1Session2();
                setMobileMenuOpen(false);
              }}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs font-semibold text-emerald-200"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Act 1: Session 2</span>
            </button>

            <button
              onClick={() => {
                onRunAct2Guardrail();
                setMobileMenuOpen(false);
              }}
              disabled={isRunning}
              className="flex items-center justify-center gap-2 p-2 rounded-lg bg-rose-950/40 border border-rose-800 text-xs font-semibold text-rose-200"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Act 2: Refactor Guardrail</span>
            </button>
          </div>

          <div className="flex items-center justify-around pt-2 border-t border-slate-800 text-xs">
            {onOpenPlayground && (
              <button
                onClick={() => {
                  onOpenPlayground();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
              >
                <Terminal className="w-4 h-4" />
                <span>Cypher Playground</span>
              </button>
            )}
            {onOpenHistory && (
              <button
                onClick={() => {
                  onOpenHistory();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300"
              >
                <History className="w-4 h-4" />
                <span>History</span>
              </button>
            )}
            {onOpenGuide && (
              <button
                onClick={() => {
                  onOpenGuide();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300"
              >
                <BookOpen className="w-4 h-4" />
                <span>Guide</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
