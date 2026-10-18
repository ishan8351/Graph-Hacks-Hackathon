"use client";

import React, { useState } from "react";
import {
  BookOpen, Brain, Command, Database, History, Menu, Play, RotateCcw,
  ShieldAlert, Sparkles, Terminal, X,
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
  onOpenBrain?: () => void;
}

export default function TopNav(props: TopNavProps) {
  const {
    currentTenant, onTenantChange, onResetGraph, onRunAct1Session1,
    onRunAct1Session2, onRunAct2Guardrail, isRunning, activeScenario,
    connectionStatus = "connected", onOpenPlayground, onOpenHistory, onOpenGuide, onOpenBrain,
  } = props;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLive = Boolean(activeScenario) || connectionStatus === "live";
  const status = isLive ? "Stream running" : connectionStatus === "disconnected"
    ? "API unavailable" : connectionStatus === "connecting" ? "Connecting" : "Graph connected";

  const tools = [
    onOpenPlayground && { label: "Cypher", action: onOpenPlayground, icon: Terminal },
    onOpenBrain && { label: "Brain", action: onOpenBrain, icon: Brain },
    onOpenHistory && { label: "Runs", action: onOpenHistory, icon: History },
    onOpenGuide && { label: "Guide", action: onOpenGuide, icon: BookOpen },
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <header className="workbench-header">
      <div className="masthead-row">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Database size={19} strokeWidth={1.8} /></div>
          <div className="brand-copy">
            <div className="brand-kicker">AEM <span>·</span> FALKORDB GRAPH MEMORY</div>
            <h1>Active Engineering Memory Layer</h1>
          </div>
        </div>

        <div className="header-right">
          <label className="tenant-field" htmlFor="tenant-select">
            <span>GRAPH</span>
            <select id="tenant-select" value={currentTenant} onChange={(e) => onTenantChange(e.target.value)} disabled={isRunning}>
              <option value="tenant_project_alpha">Billing Core</option>
              <option value="tenant_project_beta">Logistics &amp; Carriers</option>
              {!['tenant_project_alpha', 'tenant_project_beta'].includes(currentTenant) && <option value={currentTenant}>{currentTenant} · custom graph</option>}
            </select>
          </label>
          <div className={`connection-state ${isLive ? "is-live" : connectionStatus === "disconnected" ? "is-offline" : ""}`} role="status">
            <span className="connection-dot" />{status}
          </div>
          <button className="mobile-menu-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Close actions menu" : "Open actions menu"} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      <div className="command-row">
        <div className="scenario-heading"><Command size={14} /><span>PREPARED DEMOS</span></div>
        <nav className="scenario-actions" aria-label="Scenario controls">
          <button className={`scenario-button ${activeScenario === "scenario-a1" ? "is-active" : ""}`} onClick={onRunAct1Session1} disabled={isRunning} title="Run this prepared trace. Use Ask agents below to enter your own message." aria-label="Run prepared trace 1: Recover a dropped payment webhook">
            <span className="scenario-index">01</span><span className="scenario-label">Recover a dropped payment webhook</span><kbd>1</kbd><Play className="scenario-play" size={13} />
          </button>
          <button className={`scenario-button ${activeScenario === "scenario-a2" ? "is-active" : ""}`} onClick={onRunAct1Session2} disabled={isRunning} title="Run this prepared trace. Run demo 1 first to record the recovery." aria-label="Run prepared trace 2: Route around a failed endpoint">
            <span className="scenario-index">02</span><span className="scenario-label">Route around a failed endpoint</span><kbd>2</kbd><Sparkles className="scenario-play" size={13} />
          </button>
          <button className={`scenario-button scenario-guardrail ${activeScenario === "scenario-b" ? "is-active" : ""}`} onClick={onRunAct2Guardrail} disabled={isRunning} title="Run the prepared PaymentRetryWorker safety check. Use Ask agents for a custom question." aria-label="Run prepared trace 3: Refactor PaymentRetryWorker">
            <span className="scenario-index">03</span><span className="scenario-label">Refactor PaymentRetryWorker</span><kbd>3</kbd><ShieldAlert className="scenario-play" size={14} />
          </button>
        </nav>
        <div className="command-tools">
          {tools.map(({ label, action, icon: Icon }) => <button key={label} onClick={action} aria-label={label === "Runs" ? "Run History" : label === "Guide" ? "Architecture Guide & Keybindings" : label === "Brain" ? "Company Brain" : "Cypher Workspace"} title={label === "Runs" ? "Run History" : label === "Guide" ? "Architecture Guide & Keybindings" : label === "Brain" ? "Ask company knowledge and manage agent memory" : "Cypher Workspace"} className="tool-button"><Icon size={15} /><span>{label}</span></button>)}
          <button onClick={onResetGraph} disabled={isRunning} className="reset-button" title="Reset and seed target graph [R]" aria-label="Reset & Seed Graph"><RotateCcw size={14} className={isRunning ? "spin-icon" : ""} /><span>Reset graph</span><kbd>R</kbd></button>
        </div>
      </div>

      {mobileMenuOpen && <div className="mobile-command-panel">
        <label className="tenant-field" htmlFor="tenant-select-mobile"><span>GRAPH</span><select id="tenant-select-mobile" value={currentTenant} onChange={(e) => onTenantChange(e.target.value)} disabled={isRunning}><option value="tenant_project_alpha">Billing Core</option><option value="tenant_project_beta">Logistics &amp; Carriers</option>{!['tenant_project_alpha', 'tenant_project_beta'].includes(currentTenant) && <option value={currentTenant}>{currentTenant} · custom graph</option>}</select></label>
        <div className="mobile-tool-row">{tools.map(({ label, action, icon: Icon }) => <button key={label} onClick={() => { action(); setMobileMenuOpen(false); }} className="tool-button"><Icon size={15} />{label}</button>)}<button onClick={() => { onResetGraph(); setMobileMenuOpen(false); }} disabled={isRunning} className="reset-button"><RotateCcw size={14} />Reset graph</button></div>
      </div>}
    </header>
  );
}
