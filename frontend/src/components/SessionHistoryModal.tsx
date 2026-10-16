"use client";

import React from "react";
import { History, X, Trash2, ArrowRight, CheckCircle2, ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import { MemoryLayerEvent } from "../types/events";

export interface SessionRecord {
  id: string;
  scenarioName: string;
  scenarioId: string;
  tenant: string;
  timestamp: string;
  eventCount: number;
  status: string;
  events: MemoryLayerEvent[];
}

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionRecord[];
  onSelectSession: (session: SessionRecord) => void;
  onClearHistory: () => void;
}

export default function SessionHistoryModal({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onClearHistory,
}: SessionHistoryModalProps) {
  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    if (status === "BLOCKED_BY_GUARDRAIL") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <ShieldAlert className="w-3 h-3" />
          BLOCKED
        </span>
      );
    }
    if (status === "SUCCESS") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <CheckCircle2 className="w-3 h-3" />
          SUCCESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
        <AlertTriangle className="w-3 h-3" />
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b1329] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Execution History
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                  {sessions.length} runs
                </span>
              </h2>
              <p className="text-xs text-slate-400">Review and replay recorded multi-agent swarm trajectories</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No session history yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Execute Act 1 or Act 2 from the top navbar to record multi-agent reasoning runs.
              </p>
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700 transition space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{sess.scenarioName}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(sess.timestamp).toLocaleTimeString()}
                      </span>
                      <span>Tenant: <strong className="text-slate-300">{sess.tenant}</strong></span>
                      <span>{sess.eventCount} events</span>
                    </div>
                  </div>
                  {getStatusBadge(sess.status)}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      onSelectSession(sess);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                  >
                    <span>Inspect Events</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900/60">
            <button
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
            <span className="text-[11px] text-slate-500 font-mono">
              Persisted in local session storage
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
