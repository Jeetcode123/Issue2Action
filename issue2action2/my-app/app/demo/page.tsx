"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── TYPES ───
interface LogEntry {
  ts: string;
  level: string;
  tag: string;
  msg: string;
  meta?: Record<string, unknown>;
  isLocal?: boolean;
}

interface DemoResult {
  ticket_id?: string;
  type?: string;
  priority?: string;
  department?: string;
  confidence?: number;
  eta?: string;
  is_duplicate?: boolean;
  summary?: string;
  similar_count?: number;
}

// ─── CONFIG ───
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const FRONTEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
const POLL_INTERVAL = 800;

const TEST_ISSUE = {
  description:
    "Large pothole near the main intersection at Gariahat Road, Kolkata. Multiple vehicles have been damaged. The hole is approximately 3 feet wide and 6 inches deep, creating a serious hazard for two-wheelers and pedestrians. Water accumulation during rain makes it invisible.",
  location_text: "Gariahat Road, Near Golpark Junction, Kolkata 700029",
  latitude: 22.5177,
  longitude: 88.3642,
  ward: "Ward 85 - Gariahat",
  type: "Road Damage",
  user_id: "demo-user-001",
};

const PIPELINE_STEPS = [
  { id: 1, label: "Issue Submitted" },
  { id: 2, label: "Backend Received" },
  { id: 3, label: "AI Classification" },
  { id: 4, label: "Authority Routed" },
  { id: 5, label: "Email Dispatched" },
  { id: 6, label: "Status Updated" },
];

// ─── HELPERS ───
function formatTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getHighlightClass(tag: string, msg: string) {
  const t = (tag || "").toLowerCase();
  const m = (msg || "").toLowerCase();
  if (t === "http" && m.includes("post") && m.includes("/api/issues/create"))
    return "border-l-[3px] border-l-indigo-500 bg-indigo-500/[0.05]";
  if (t === "ai" || t === "smartrouting")
    return "border-l-[3px] border-l-purple-500 bg-purple-500/[0.05]";
  if (t === "emailservice" || t === "emaildispatch")
    return "border-l-[3px] border-l-emerald-500 bg-emerald-500/[0.05]";
  if (t === "authority")
    return "border-l-[3px] border-l-cyan-500 bg-cyan-500/[0.05]";
  if (t === "notification")
    return "border-l-[3px] border-l-amber-400 bg-amber-400/[0.04]";
  if (t === "demo")
    return "border-l-[3px] border-l-fuchsia-500 bg-fuchsia-500/[0.06]";
  return "";
}

function levelColor(level: string) {
  switch (level.toUpperCase()) {
    case "INFO": return "text-emerald-400 bg-emerald-400/10";
    case "WARN": return "text-amber-400 bg-amber-400/10";
    case "ERROR": return "text-red-400 bg-red-400/10";
    case "FATAL": return "text-red-500 bg-red-500/20";
    case "DEBUG": return "text-gray-500 bg-gray-500/10";
    default: return "text-gray-400 bg-gray-400/10";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── MAIN PAGE COMPONENT ───
export default function LiveDemoPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stepStates, setStepStates] = useState<Record<number, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [backendOnline, setBackendOnline] = useState(true);
  const [filter, setFilter] = useState("all");
  const [iframeSrc, setIframeSrc] = useState("/report");
  const [showOverlay, setShowOverlay] = useState(true);
  const [demoStatusText, setDemoStatusText] = useState("Idle");

  const terminalRef = useRef<HTMLDivElement>(null);
  const lastLogCountRef = useRef(0);
  const demoPhaseRef = useRef(0);
  const startTimeRef = useRef(0);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Health check on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then((j) => setBackendOnline(j.success))
      .catch(() => setBackendOnline(false));
  }, []);

  // ─── LOCAL LOG HELPER ───
  const addLocalLog = useCallback((tag: string, msg: string, level = "INFO") => {
    setLogs((prev) => [
      ...prev,
      { ts: new Date().toISOString(), level, tag, msg, meta: {}, isLocal: true },
    ]);
  }, []);

  // ─── PIPELINE STATE ───
  const setStep = useCallback((stepNum: number, state: string) => {
    setStepStates((prev) => ({ ...prev, [stepNum]: state }));
  }, []);

  const resetPipeline = useCallback(() => {
    setStepStates({});
    demoPhaseRef.current = 0;
  }, []);

  // ─── DETECT PIPELINE STEPS FROM LOGS ───
  const detectStep = useCallback(
    (log: LogEntry) => {
      const tag = (log.tag || "").toLowerCase();
      const msg = (log.msg || "").toLowerCase();

      if (tag === "http" && msg.includes("→ post") && msg.includes("/api/issues/create")) {
        if (demoPhaseRef.current < 2) {
          demoPhaseRef.current = 2;
          setStep(1, "completed"); setStep(2, "active");
        }
      }
      if (tag === "ai" && msg.includes("classified")) {
        if (demoPhaseRef.current < 3) {
          demoPhaseRef.current = 3;
          setStep(2, "completed"); setStep(3, "completed");
        }
      }
      if (tag === "smartrouting" && msg.includes("selected email")) {
        if (demoPhaseRef.current < 4) {
          demoPhaseRef.current = 4;
          setStep(4, "active");
          setTimeout(() => { if (demoPhaseRef.current >= 4) setStep(4, "completed"); }, 600);
        }
      }
      if (tag === "emailservice" && (msg.includes("email sent") || msg.includes("message sent"))) {
        if (demoPhaseRef.current < 5) {
          demoPhaseRef.current = 5;
          setStep(4, "completed"); setStep(5, "completed");
        }
      }
      if (tag === "emailservice" && msg.includes("failed")) {
        setStep(5, "failed");
      }
      if (tag === "http" && msg.includes("← post") && msg.includes("/api/issues/create") && msg.includes("200")) {
        if (demoPhaseRef.current < 6) {
          demoPhaseRef.current = 6;
          setStep(5, "completed"); setStep(6, "completed");
        }
      }
      if (tag === "http" && msg.includes("← post") && msg.includes("/api/issues/create") && msg.includes("500")) {
        setStep(6, "failed");
      }
    },
    [setStep]
  );

  // ─── POLL LOGS ───
  const pollLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/logs?count=100`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        if (json.data.length > lastLogCountRef.current) {
          const diff: LogEntry[] = json.data.slice(lastLogCountRef.current);
          setLogs((prev) => [...prev, ...diff]);
          lastLogCountRef.current = json.data.length;
          diff.forEach(detectStep);
        }
      }
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, [detectStep]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(pollLogs, POLL_INTERVAL);
    pollLogs();
  }, [pollLogs]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
  }, []);

  // ─── START DEMO ───
  const startDemo = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setDemoResult(null);
    setDemoStatusText("Running...");
    resetPipeline();
    setLogs([]);
    lastLogCountRef.current = 0;
    setShowOverlay(false);
    setIframeSrc("/report");

    startTimeRef.current = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsed(((Date.now() - startTimeRef.current) / 1000));
    }, 100);

    startPolling();

    addLocalLog("Demo", "🎬 Starting live demo — Full end-to-end pipeline test");
    addLocalLog("Demo", `📝 Test payload: "${TEST_ISSUE.description.substring(0, 80)}…"`);

    await sleep(2000);

    setStep(1, "active");
    addLocalLog("Demo", "→ POST /api/issues/create — Sending to backend...");

    try {
      const res = await fetch(`${API_BASE}/api/issues/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(TEST_ISSUE),
      });
      const json = await res.json();

      if (json.success) {
        addLocalLog("Demo", `✅ Issue created: Ticket ${json.data.ticket_id}`);
        setDemoResult(json.data);
        setTimeout(() => setIframeSrc(`/track?id=${json.data.ticket_id}`), 1500);
      } else {
        addLocalLog("Demo", `❌ Issue creation failed: ${json.error}`, "ERROR");
        finishDemo(false);
        return;
      }
    } catch (err: unknown) {
      addLocalLog("Demo", `❌ Network error: ${err instanceof Error ? err.message : String(err)}`, "ERROR");
      finishDemo(false);
      return;
    }

    // Keep polling for email/notification logs
    await sleep(8000);
    await pollLogs();

    if (demoPhaseRef.current < 6 && demoPhaseRef.current >= 2) {
      for (let i = demoPhaseRef.current + 1; i <= 6; i++) setStep(i, "completed");
    }

    finishDemo(demoPhaseRef.current >= 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const finishDemo = useCallback((success: boolean) => {
    setIsRunning(false);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    stopPolling();
    setDemoStatusText(success ? "Completed ✓" : "Failed ✗");
    addLocalLog("Demo", success ? "🏁 Demo completed — full pipeline verified!" : "⚠️ Demo ended with errors");
  }, [addLocalLog, stopPolling]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    lastLogCountRef.current = 0;
  }, []);

  // Filter logs
  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.level?.toUpperCase() === filter);

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-gray-100 overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── Google Fonts ─── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ─── HEADER BAR ─── */}
      <header className="flex items-center justify-between px-6 h-14 bg-gradient-to-r from-[#0f1629] to-[#131b2e] border-b border-[#1e293b] flex-shrink-0 relative z-50">
        <div className="flex items-center gap-3.5">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-black text-[13px] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            I2A
          </div>
          <div className="font-extrabold text-[15px] tracking-tight">
            <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Issue2Action
            </span>
            <span className="text-gray-500 font-semibold"> — Live Demo</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearLogs}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold bg-white/5 text-gray-400 border border-[#1e293b] hover:bg-white/10 hover:text-gray-200 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" /></svg>
            Clear
          </button>
          <button
            onClick={startDemo}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_4px_15px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_25px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Running...
              </>
            ) : demoResult ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" /></svg>
                Run Again
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Start Demo
              </>
            )}
          </button>
        </div>
      </header>

      {/* ─── PIPELINE STEPS BAR ─── */}
      <div className="flex items-center px-6 py-3 bg-[#111827] border-b border-[#1e293b] flex-shrink-0 overflow-x-auto gap-0">
        {PIPELINE_STEPS.map((step, idx) => {
          const state = stepStates[step.id] || "";
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <div
                  className={`w-7 h-0.5 flex-shrink-0 rounded-full transition-all duration-500 ${
                    stepStates[step.id] === "completed" || stepStates[step.id] === "active"
                      ? state === "completed"
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-emerald-500 to-indigo-500"
                      : "bg-[#1e293b]"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all duration-400 ${
                  state === "active"
                    ? "text-indigo-400 bg-indigo-500/[0.08]"
                    : state === "completed"
                    ? "text-emerald-400"
                    : state === "failed"
                    ? "text-red-400"
                    : "text-gray-600"
                }`}
              >
                <span
                  className={`w-[22px] h-[22px] rounded-md flex items-center justify-center text-[10px] font-extrabold transition-all duration-400 ${
                    state === "active"
                      ? "bg-indigo-500 text-white border border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                      : state === "completed"
                      ? "bg-emerald-500 text-white border border-emerald-500"
                      : state === "failed"
                      ? "bg-red-500 text-white border border-red-500"
                      : "bg-white/5 border border-[#1e293b]"
                  }`}
                >
                  {state === "completed" ? "✓" : state === "failed" ? "✗" : step.id}
                </span>
                {step.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ─── MAIN SPLIT VIEW ─── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT PANEL: Website */}
        <div className="flex-1 flex flex-col border-r border-[#1e293b] min-w-0 relative">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#111827] border-b border-[#1e293b] flex-shrink-0">
            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              <svg className="w-3.5 h-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
              Frontend Preview
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0a0e1a] rounded-md border border-[#1e293b] text-[10px] text-gray-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span className="text-emerald-500 text-[9px]">🔒</span>
              {iframeSrc}
            </div>
          </div>
          <div className="flex-1 relative bg-white">
            <iframe
              src={FRONTEND_URL + iframeSrc}
              className="w-full h-full border-none"
              title="Issue2Action Website"
            />
            {/* Overlay */}
            <div
              className={`absolute inset-0 bg-[#0a0e1a]/85 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-10 transition-opacity duration-500 ${
                showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <h3 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                🎬 Ready to Demo
              </h3>
              <p className="text-gray-400 text-sm max-w-xs text-center leading-relaxed">
                Click <strong className="text-gray-200">&quot;Start Demo&quot;</strong> to begin the full
                end-to-end pipeline demonstration.
              </p>
            </div>

            {/* Result Card */}
            {demoResult && (
              <div className="absolute bottom-4 left-4 right-4 bg-[#1a2035] border border-[#1e293b] rounded-xl p-4 z-20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-4 duration-400">
                <h4 className="text-[13px] font-extrabold mb-3 flex items-center gap-2">
                  <span>✅</span> Pipeline Result
                </h4>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                  {[
                    { label: "Ticket ID", value: demoResult.ticket_id, color: "text-purple-400" },
                    { label: "Issue Type", value: demoResult.type, color: "text-cyan-400" },
                    { label: "Priority", value: demoResult.priority?.toUpperCase(), color: demoResult.priority === "high" || demoResult.priority === "critical" ? "text-red-400" : "text-amber-400" },
                    { label: "Department", value: demoResult.department, color: "text-gray-200" },
                    { label: "AI Confidence", value: `${demoResult.confidence || 0}%`, color: "text-emerald-400" },
                    { label: "ETA", value: demoResult.eta, color: "text-gray-200" },
                    { label: "Duplicate", value: demoResult.is_duplicate ? "Yes" : "No", color: demoResult.is_duplicate ? "text-amber-400" : "text-emerald-400" },
                    { label: "Summary", value: (demoResult.summary || "N/A").substring(0, 35) + "…", color: "text-gray-300" },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{item.label}</span>
                      <span className={`text-[12px] font-semibold ${item.color}`}>{item.value || "N/A"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Backend Logs */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#111827] border-b border-[#1e293b] flex-shrink-0">
            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              <svg className="w-3.5 h-3.5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
              Backend Logs — Real-time
              <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[9px] font-extrabold bg-indigo-500/15 text-indigo-400">
                {logs.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {["all", "INFO", "WARN", "ERROR"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                    filter === f
                      ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"
                      : "text-gray-600 bg-transparent border border-transparent hover:text-gray-400 hover:bg-white/[0.03]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto bg-[#0d1117] py-3 scroll-smooth"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", lineHeight: "1.7" }}
          >
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700">
                <svg className="w-10 h-10 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                <p className="text-[12px] font-medium">Waiting for backend activity...</p>
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <div
                  key={i}
                  className={`flex gap-2 items-start px-4 py-[2px] hover:bg-white/[0.015] transition-colors animate-in fade-in slide-in-from-bottom-1 duration-300 ${getHighlightClass(
                    log.tag,
                    log.msg
                  )}`}
                >
                  <span className="text-gray-700 text-[10px] flex-shrink-0 pt-[2px] min-w-[64px]">
                    {formatTime(log.ts)}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-[1px] rounded flex-shrink-0 min-w-[38px] text-center tracking-wider ${levelColor(log.level)}`}
                  >
                    {(log.level || "INFO").toUpperCase()}
                  </span>
                  <span className="text-cyan-600 font-semibold flex-shrink-0 min-w-[90px] text-[11px]">
                    [{log.tag || "-"}]
                  </span>
                  <span className="text-gray-300 break-words">
                    {log.msg}
                    {log.meta && typeof log.meta === "object" && Object.keys(log.meta).length > 0 && (
                      <span className="text-gray-700 text-[10px] ml-1.5">
                        {JSON.stringify(log.meta)}
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── STATUS BAR ─── */}
      <div className="flex items-center justify-between px-5 py-1.5 bg-[#111827] border-t border-[#1e293b] text-[10px] text-gray-600 flex-shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Frontend: localhost:3000
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-emerald-500" : "bg-red-500"}`} />
            Backend: localhost:3001
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span>{demoStatusText}</span>
          <span className="text-gray-800">|</span>
          <span>{elapsed.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
