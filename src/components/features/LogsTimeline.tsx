import React, { useRef, useEffect } from 'react';
import { ProcessingLog, VerificationStatus } from '@/types/kyc';
import { Terminal, Shield, Play, Pause, FastForward } from 'lucide-react';

interface LogsTimelineProps {
  logs: ProcessingLog[];
  status: VerificationStatus;
  isPaused: boolean;
  speed: number;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
}

export const LogsTimeline: React.FC<LogsTimelineProps> = ({
  logs,
  status,
  isPaused,
  speed,
  onTogglePause,
  onSpeedChange,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll the logs terminal to the bottom as new logs arrive
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Determine stage visual progress
  const getStageStatus = (stageName: string): 'idle' | 'running' | 'success' | 'failed' | 'warning' => {
    if (status === 'idle') return 'idle';

    const stageLogs = logs.filter(l => l.stage === stageName);
    const hasError = stageLogs.some(l => l.level === 'error');
    const hasWarning = stageLogs.some(l => l.level === 'warning');
    const hasSuccess = stageLogs.some(l => l.level === 'success');

    // If verification has reached a final verdict
    const isFinalStatus = status === 'success' || status === 'warning' || status === 'failed';

    if (stageName === 'received') {
      if (status === 'uploading') return 'running';
      return 'success';
    }

    if (stageName === 'ocr') {
      if (status === 'uploading') return 'idle';
      if (status === 'processing' && stageLogs.length === 0) return 'running';
      if (hasError) return 'failed';
      if (hasWarning) return 'warning';
      if (hasSuccess || isFinalStatus) return 'success';
      return 'running';
    }

    if (stageName === 'alignment' || stageName === 'forgery') {
      const ocrComplete = logs.some(l => l.stage === 'ocr' && l.level === 'success');
      if (!ocrComplete) return 'idle';
      if (status === 'processing' && stageLogs.length === 0) return 'running';
      if (hasError) return 'failed';
      if (hasWarning) return 'warning';
      if (hasSuccess || isFinalStatus) return 'success';
      return 'running';
    }

    if (stageName === 'biometrics') {
      const forgeryComplete = logs.some(l => l.stage === 'forgery');
      if (!forgeryComplete) return 'idle';
      if (status === 'processing' && stageLogs.length === 0) return 'running';
      if (hasError) return 'failed';
      if (hasWarning) return 'warning';
      if (hasSuccess || isFinalStatus) return 'success';
      return 'running';
    }

    if (stageName === 'final') {
      if (!isFinalStatus) return 'idle';
      if (status === 'success') return 'success';
      if (status === 'warning') return 'warning';
      if (status === 'failed') return 'failed';
    }

    return 'idle';
  };

  const getStageIndicator = (stageName: string, label: string) => {
    const stageStatus = getStageStatus(stageName);
    
    let ringColor = 'border-slate-800 bg-slate-900 text-slate-600';
    let pulseColor = '';
    let icon = <span>•</span>;

    if (stageStatus === 'running') {
      ringColor = 'border-indigo-500 bg-indigo-950/40 text-indigo-400';
      pulseColor = 'animate-ping border-indigo-500';
      icon = <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />;
    } else if (stageStatus === 'success') {
      ringColor = 'border-emerald-500 bg-emerald-950/30 text-emerald-400';
      icon = <span className="text-[9px] font-bold">✓</span>;
    } else if (stageStatus === 'warning') {
      ringColor = 'border-amber-500 bg-amber-950/30 text-amber-400';
      icon = <span className="text-[9px] font-bold">!</span>;
    } else if (stageStatus === 'failed') {
      ringColor = 'border-rose-500 bg-rose-950/30 text-rose-400';
      icon = <span className="text-[9px] font-bold">✗</span>;
    }

    return (
      <div className="flex items-center space-x-3.5 z-10 group">
        <div className="relative flex items-center justify-center">
          {pulseColor && (
            <span className={`absolute inline-flex h-6 w-6 rounded-full border opacity-75 ${pulseColor}`} />
          )}
          <div className={`relative w-6 h-6 rounded-full border flex items-center justify-center font-mono transition-colors duration-300 ${ringColor}`}>
            {icon}
          </div>
        </div>
        <div>
          <span className={`text-xs font-bold transition-colors duration-300 block
            ${stageStatus === 'running' ? 'text-indigo-400 glow-text-indigo' : ''}
            ${stageStatus === 'success' ? 'text-slate-200' : ''}
            ${stageStatus === 'idle' ? 'text-slate-500' : ''}
            ${stageStatus === 'warning' ? 'text-amber-400 font-semibold' : ''}
            ${stageStatus === 'failed' ? 'text-rose-400 font-semibold' : ''}
          `}>
            {label}
          </span>
          <span className="text-[9px] text-slate-500 block uppercase mt-0.5 tracking-wider">
            {stageStatus === 'idle' && 'Queued'}
            {stageStatus === 'running' && 'Processing'}
            {stageStatus === 'success' && 'Passed / Success'}
            {stageStatus === 'warning' && 'Audit Warning'}
            {stageStatus === 'failed' && 'Check Failed'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full lg:w-80 flex flex-col gap-4">
      
      {/* 1. Visual Verification Pipeline */}
      <div className="glass-panel rounded-xl p-5 relative overflow-hidden flex-1">
        <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Verification Stages</span>
          <Shield className="w-4 h-4 text-indigo-400" />
        </div>

        {/* Pipeline connecting vertical line */}
        <div className="relative flex flex-col space-y-5 justify-between py-1">
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-slate-800 z-0" />
          
          {getStageIndicator('received', 'Document Ingestion')}
          {getStageIndicator('ocr', 'OCR Text Extraction')}
          {getStageIndicator('forgery', 'Anti-Forgery & Tamper Audit')}
          {getStageIndicator('biometrics', 'Biometric Verification')}
          {getStageIndicator('final', 'Final Decision Verdict')}
        </div>
      </div>

      {/* 2. Developer Monospace Terminal Ticker */}
      <div className="glass-panel rounded-xl p-5 flex flex-col h-72">
        <div className="flex items-center justify-between mb-3.5 border-b border-slate-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Logging Stream</span>
          </div>
          
          {/* Timeline Simulation Controls */}
          {status === 'processing' && (
            <div className="flex items-center space-x-1.5">
              {/* Play/Pause Button */}
              <button
                onClick={onTogglePause}
                title={isPaused ? 'Resume' : 'Pause'}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded hover:text-white transition-colors"
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
              {/* Speed Boost Button */}
              <button
                onClick={() => onSpeedChange(speed === 1 ? 2.5 : speed === 2.5 ? 5 : 1)}
                title="Simulation Speed"
                className={`px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[9px] rounded font-bold transition-all flex items-center
                  ${speed > 1 ? 'text-indigo-400 border border-indigo-500/30' : 'text-slate-400'}
                `}
              >
                <FastForward className="w-2.5 h-2.5 mr-0.5" /> {speed}x
              </button>
            </div>
          )}
        </div>

        {/* Monospace Output */}
        <div className="flex-1 bg-slate-950/80 border border-slate-900 rounded-lg p-3 font-mono text-[10px] text-slate-300 overflow-y-auto leading-relaxed shadow-inner">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600">
              <span>Waiting for document stream ingestion...</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => {
                let textClass = 'text-slate-300';
                if (log.level === 'success') textClass = 'text-emerald-400';
                if (log.level === 'warning') textClass = 'text-amber-400 font-semibold';
                if (log.level === 'error') textClass = 'text-rose-400 font-bold';

                return (
                  <div key={log.id} className="flex items-start">
                    <span className="text-[9px] text-slate-600 select-none mr-2 font-semibold">
                      [{log.timestamp}]
                    </span>
                    <span className={textClass}>{log.message}</span>
                  </div>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
