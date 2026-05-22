'use client';

import React from 'react';
import { Fingerprint, Database, RotateCcw, ScanLine, Radio, Lightbulb, LockKeyhole, CircleAlert } from 'lucide-react';
import { AnalyticsGrid } from '@/components/features/AnalyticsGrid';
import { UploadDropzone } from '@/components/features/UploadDropzone';
import { SplitScreenWorkflow } from '@/components/features/SplitScreenWorkflow';
import { LogsTimeline } from '@/components/features/LogsTimeline';
import { useKYCWorkflow } from '@/hooks/useKYCWorkflow';

export default function Home() {
  const {
    status,
    uploadProgress,
    activeDoc,
    logs,
    metrics,
    isPaused,
    simulationSpeed,
    activeScenarioId,
    apiConnected,
    apiError,
    mounted,
    handleReset,
    handleSelectTemplate,
    handleCustomFileUpload,
    handleTogglePause,
    handleSpeedChange,
  } = useKYCWorkflow();

  if (!mounted) {
    return null; // Avoid hydration mismatch on initial render
  }

  return (
    <div className="flex-1 bg-[#0a0814] text-violet-50 flex flex-col min-h-screen">
      {/* Top Banner Header */}
      <header className="border-b border-violet-900/40 bg-violet-950/30 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400 border border-violet-500/25">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center">
              KYC SECURE <span className="ml-2 text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded">V1.2</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Real-time Intelligent Document Auditing Platform</p>
          </div>
        </div>

        {/* Global System Status Signals */}
        <div className="flex items-center space-x-6 text-xs text-slate-400">
          <div className="hidden sm:flex items-center space-x-2">
            <ScanLine className="w-3.5 h-3.5 text-violet-500/70" />
            <span className="font-mono text-[10px]">OCR ENGINE: ACTIVE</span>
          </div>
          <div className="hidden sm:flex items-center space-x-2">
            <Database className={`w-3.5 h-3.5 ${apiConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className={`font-mono text-[10px] ${apiConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
              API VERIFY: {apiConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
          <div
            className={`flex items-center space-x-2 px-2.5 py-1 rounded-full border ${
              apiConnected
                ? 'bg-emerald-500/5 border-emerald-500/15'
                : 'bg-amber-500/5 border-amber-500/15'
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${apiConnected ? 'text-emerald-400' : 'text-amber-400'}`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                apiConnected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {apiConnected ? 'SYSTEMS NORMAL' : 'DEMO MODE'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Core Dashboard Layout Wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col">
        {/* Page Title & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">KYC Verification Hub</h2>
            <p className="text-xs text-slate-400 mt-1">
              Analyze OCR confidence intervals, biometric alignments, and document anti-forgery parameters.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              disabled={status === 'idle'}
              className={`px-3 py-1.5 bg-violet-950/50 hover:bg-violet-900/40 text-violet-200 hover:text-white rounded-lg text-xs font-semibold flex items-center border border-violet-800/40 transition-all
                ${status === 'idle' ? 'opacity-40 pointer-events-none' : ''}
              `}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear / Reset
            </button>
          </div>
        </div>

        {/* 1. Analytics Cards Row */}
        <AnalyticsGrid metrics={metrics} />

        {/* 2. Upload Dropzone Presets Section */}
        <UploadDropzone
          status={status}
          progress={uploadProgress}
          selectedDocId={activeScenarioId}
          onSelectTemplate={handleSelectTemplate}
          onCustomFileUpload={handleCustomFileUpload}
          onReset={handleReset}
        />

        {/* 3. Split-Screen Workflow and Logs Timeline */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <div className="flex-1">
            <SplitScreenWorkflow document={activeDoc} status={status} />
          </div>
          
          <LogsTimeline
            logs={logs}
            status={status}
            isPaused={isPaused}
            speed={simulationSpeed}
            onTogglePause={handleTogglePause}
            onSpeedChange={handleSpeedChange}
          />
        </div>

        {apiError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Security Warning Footnote */}
        <footer className="mt-8 border-t border-violet-900/30 pt-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-violet-300/50 gap-4">
          <div className="flex items-center space-x-1.5">
            <LockKeyhole className="w-3.5 h-3.5 text-violet-600/60" />
            <span>End-to-End Encrypted Tunnel active — ISO 27001 Certified SOC2 Compliant</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-violet-950/40 px-3 py-1.5 rounded-lg border border-violet-800/30">
            <Lightbulb className="w-3.5 h-3.5 text-violet-400" />
            <span>Click preset scenarios to test verification success, tampering detection, and document recency limits.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
