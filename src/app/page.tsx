'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Server, RefreshCw, Cpu, Activity, Info, Globe, AlertCircle } from 'lucide-react';
import { KYCDocument, ProcessingLog, VerificationStatus, AnalyticsMetrics, LogLevel } from '@/types/kyc';
import { MOCK_DOCUMENTS, MOCK_METRICS, SIMULATION_LOGS } from '@/constants/mockData';
import { AnalyticsGrid } from '@/components/AnalyticsGrid';
import { UploadDropzone } from '@/components/UploadDropzone';
import { SplitScreenWorkflow } from '@/components/SplitScreenWorkflow';
import { LogsTimeline } from '@/components/LogsTimeline';

export default function Home() {
  // Core State
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [activeDoc, setActiveDoc] = useState<KYCDocument | null>(null);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(MOCK_METRICS);

  // Simulation controls
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  
  // Refs for tracking simulation intervals & active step
  const simulationRef = useRef<{
    logQueue: Omit<ProcessingLog, 'timestamp'>[];
    currentIndex: number;
    currentDoc: KYCDocument;
    isUploading: boolean;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any running simulation timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset the dashboard back to default idle state
  const handleReset = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setUploadProgress(0);
    setActiveDoc(null);
    setLogs([]);
    setIsPaused(false);
    setActiveScenarioId(null);
    simulationRef.current = null;
  }, [clearTimers]);

  // Advance the simulation one step
  const advanceSimulation = useCallback(() => {
    if (!simulationRef.current || isPaused) return;

    const sim = simulationRef.current;

    // Phase 1: Uploading progress
    if (sim.isUploading) {
      setUploadProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 15 + 5) * simulationSpeed;
        if (next >= 100) {
          sim.isUploading = false;
          setStatus('processing');
          
          // Add first OCR log immediately
          if (sim.logQueue.length > 0) {
            const firstLog = sim.logQueue[0];
            const timestamp = new Date().toLocaleTimeString();
            setLogs([{
              ...firstLog,
              timestamp
            }]);
            sim.currentIndex = 1;
          }
          return 100;
        }
        return next;
      });
      return;
    }

    // Phase 2: Processing logs one by one
    if (sim.currentIndex < sim.logQueue.length) {
      const nextLog = sim.logQueue[sim.currentIndex];
      const timestamp = new Date().toLocaleTimeString();
      
      setLogs((prev) => [...prev, { ...nextLog, timestamp }]);
      sim.currentIndex += 1;

      // Update document visual load state as logs progress (OCR alignment)
      if (nextLog.stage === 'ocr' && nextLog.level === 'success') {
        // Triggers initial OCR reveal inside SplitScreenWorkflow
      }
    } else {
      // Phase 3: Final verdict reached
      clearTimers();
      const finalStatus = sim.currentDoc.status;
      setStatus(finalStatus);
      setActiveDoc(sim.currentDoc);

      // Adjust metrics in real-time based on the outcome of this run
      setMetrics((prev) => {
        const newTotal = prev.totalProcessed + 1;
        let newFraud = prev.activeFraudAlerts;
        let approvalAdjust = prev.approvalRate;

        if (finalStatus === 'success') {
          // Increase approval rate slightly
          approvalAdjust = Math.min(99.9, parseFloat((((prev.totalProcessed * prev.approvalRate / 100) + 1) / newTotal * 100).toFixed(1)));
        } else if (finalStatus === 'failed') {
          // Decrement approval rate, add fraud alert if applicable
          approvalAdjust = parseFloat(((prev.totalProcessed * prev.approvalRate / 100) / newTotal * 100).toFixed(1));
          newFraud = prev.activeFraudAlerts + 1;
        } else if (finalStatus === 'warning') {
          approvalAdjust = parseFloat(((prev.totalProcessed * prev.approvalRate / 100) / newTotal * 100).toFixed(1));
        }

        return {
          totalProcessed: newTotal,
          approvalRate: approvalAdjust,
          activeFraudAlerts: newFraud,
          avgProcessingTimeSec: parseFloat((Math.max(2.5, prev.avgProcessingTimeSec + (Math.random() * 0.4 - 0.2))).toFixed(1))
        };
      });
    }
  }, [isPaused, simulationSpeed, clearTimers]);

  // Handle simulation run triggers when speed or pause changes
  useEffect(() => {
    clearTimers();

    if (status === 'idle' || isPaused) return;

    // Configure loop speed (upload runs faster, logs run based on configured speed dial)
    const baseInterval = status === 'uploading' ? 120 : 800;
    const intervalTime = baseInterval / simulationSpeed;

    timerRef.current = setInterval(advanceSimulation, intervalTime);

    return () => clearTimers();
  }, [status, isPaused, simulationSpeed, advanceSimulation, clearTimers]);

  // Trigger scenario template simulation
  const handleSelectTemplate = (type: 'passport' | 'license' | 'utility_bill') => {
    handleReset();
    
    const docPreset = MOCK_DOCUMENTS[type];
    const logsPreset = SIMULATION_LOGS[type];

    if (!docPreset || !logsPreset) return;

    // Define initial ingestion log
    const timestamp = new Date().toLocaleTimeString();
    const initialLog: ProcessingLog = {
      id: 'ingestion-init',
      stage: 'received',
      message: `System connecting to ingestion stream. Incoming ${type.toUpperCase()} file detected...`,
      timestamp,
      level: 'info'
    };

    // Prepare simulation reference
    simulationRef.current = {
      logQueue: logsPreset,
      currentIndex: 0,
      currentDoc: docPreset,
      isUploading: true
    };

    setActiveScenarioId(docPreset.id);
    setActiveDoc({
      ...docPreset,
      status: 'processing' // Starts document preview in processing mode
    });
    setLogs([initialLog]);
    setStatus('uploading');
  };

  // Trigger custom file upload simulation
  const handleCustomFileUpload = (file: File) => {
    handleReset();

    // Create a mock document object representation for the custom uploaded file
    const docId = `custom-doc-${Math.floor(Math.random() * 1000)}`;
    const isPDF = file.type === 'application/pdf';
    const cleanFileName = file.name;

    const customDoc: KYCDocument = {
      id: docId,
      type: isPDF ? 'utility_bill' : 'passport', // Fallback type structure
      name: cleanFileName,
      url: isPDF ? 'utility_bill' : 'passport',
      status: 'success', // Always pass for custom files in demo mode
      boundingBoxes: isPDF 
        ? MOCK_DOCUMENTS.utility_bill.boundingBoxes 
        : MOCK_DOCUMENTS.passport.boundingBoxes,
      extractedFields: isPDF
        ? [
            { key: 'provider', label: 'Service Provider', value: 'UPLOADED STATEMENT SOURCE', confidence: 98.2 },
            { key: 'statement_date', label: 'Statement Date', value: '18 MAY 2026', confidence: 99.4, isMatch: true },
            { key: 'customer_name', label: 'Customer Name', value: 'USER TEST UPLOAD', confidence: 95.7 },
            { key: 'address', label: 'Service Address', value: '123 MAIN ST, NEW YORK, NY 10001', confidence: 96.1, isMatch: true },
            { key: 'account_number', label: 'Account Number', value: 'ACT-9821-2291', confidence: 99.0 },
            { key: 'amount_due', label: 'Amount Due', value: '$120.00', confidence: 99.8 },
          ]
        : [
            { key: 'doc_type', label: 'Document Type', value: 'PASSPORT (P)', confidence: 99.1 },
            { key: 'doc_number', label: 'Document Number', value: 'P' + Math.floor(10000000 + Math.random() * 90000000), confidence: 98.9, isMatch: true },
            { key: 'surname', label: 'Surname', value: 'USER', confidence: 99.5 },
            { key: 'given_names', label: 'Given Names', value: 'CUSTOM UPLOAD', confidence: 99.0 },
            { key: 'nationality', label: 'Nationality', value: 'UNITED STATES (USA)', confidence: 99.8 },
            { key: 'dob', label: 'Date of Birth', value: '01 JAN 1990', confidence: 99.0, isMatch: true },
            { key: 'expiry_date', label: 'Date of Expiry', value: '01 JAN 2035', confidence: 98.7, isMatch: true },
          ],
      safetyIndicators: isPDF
        ? [
            { id: 'custom-ind-1', name: 'Document Recency Check', status: 'PASSED', details: 'Document date is within 90 days.' },
            { id: 'custom-ind-2', name: 'Address Consistency Check', status: 'PASSED', details: 'Extracted address matches applicant profile.' },
            { id: 'custom-ind-3', name: 'Digital Metadata Integrity', status: 'PASSED', details: 'No editing software signatures found in metadata.' },
          ]
        : [
            { id: 'custom-ind-1', name: 'Face Match Biometrics', status: 'PASSED', details: 'Biometrics face match check completed with 95% match rating.', score: 95.0 },
            { id: 'custom-ind-2', name: 'MRZ Checksum', status: 'PASSED', details: 'MRZ barcode data and checksum fields validate successfully.', score: 100 },
            { id: 'custom-ind-3', name: 'Digital Alteration Audit', status: 'PASSED', details: 'No pixel manipulation or overlay editing detected.' },
          ],
    };

    // Custom logs timeline
    const customLogsQueue: Omit<ProcessingLog, 'timestamp'>[] = [
      { id: 'log-c1', stage: 'received', message: `Custom file "${cleanFileName}" (${(file.size / 1024 / 1024).toFixed(2)} MB) ingested.`, level: 'success' },
      { id: 'log-c2', stage: 'ocr', message: 'OCR analysis queue: Extracting structural layout...', level: 'info' },
      { id: 'log-c3', stage: 'ocr', message: `OCR complete. Identified document structural layout as ${isPDF ? 'Utility Statement' : 'Identification Passport'}.`, level: 'success' },
      { id: 'log-c4', stage: 'alignment', message: 'Bounding box positioning maps matching standard model anchors.', level: 'success' },
      { id: 'log-c5', stage: 'forgery', message: 'Executing tamper check: Analysis of metadata headers, compression artifacts, and pixel levels...', level: 'info' },
      { id: 'log-c6', stage: 'forgery', message: 'No metadata alterations or image retouch signatures detected. Forgery check passed.', level: 'success' },
      { id: 'log-c7', stage: 'biometrics', message: 'Verifying cross-registry databases and profile records...', level: 'info' },
      { id: 'log-c8', stage: 'biometrics', message: 'Validation success: Extracted fields successfully match registry reference profiles.', level: 'success' },
      { id: 'log-c9', stage: 'final', message: 'KYC Document verification PASSED. Added to approved files directory.', level: 'success' }
    ];

    const timestamp = new Date().toLocaleTimeString();
    const initialLog: ProcessingLog = {
      id: 'ingestion-init',
      stage: 'received',
      message: `System connecting to ingestion stream. Uploading custom user file...`,
      timestamp,
      level: 'info'
    };

    simulationRef.current = {
      logQueue: customLogsQueue,
      currentIndex: 0,
      currentDoc: customDoc,
      isUploading: true
    };

    setActiveScenarioId(customDoc.id);
    setActiveDoc({
      ...customDoc,
      status: 'processing'
    });
    setLogs([initialLog]);
    setStatus('uploading');
  };

  // Toggle Play/Pause state during simulation runs
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Toggle speed multipliers
  const handleSpeedChange = (speedVal: number) => {
    setSimulationSpeed(speedVal);
  };

  // Automatically trigger first passport scan scenario on initial render for premium look!
  useEffect(() => {
    const startupTimer = setTimeout(() => {
      handleSelectTemplate('passport');
    }, 800);
    return () => clearTimeout(startupTimer);
  }, []);

  return (
    <div className="flex-1 bg-[#030712] text-slate-100 flex flex-col min-h-screen">
      
      {/* Top Banner Header */}
      <header className="border-b border-slate-800 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
            <Shield className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wider uppercase flex items-center">
              KYC SECURE <span className="ml-2 text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">V1.2</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Real-time Intelligent Document Auditing Platform</p>
          </div>
        </div>

        {/* Global System Status Signals */}
        <div className="flex items-center space-x-6 text-xs text-slate-400">
          <div className="hidden sm:flex items-center space-x-2">
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono text-[10px]">OCR ENGINE: ACTIVE</span>
          </div>
          <div className="hidden sm:flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono text-[10px]">API VERIFY: CONNECTED</span>
          </div>
          <div className="flex items-center space-x-2 bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/15">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">SYSTEMS NORMAL</span>
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
              className={`px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center border border-slate-800 transition-all
                ${status === 'idle' ? 'opacity-40 pointer-events-none' : ''}
              `}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Clear / Reset
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
            <SplitScreenWorkflow
              document={activeDoc}
              status={status}
            />
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

        {/* Security Warning Footnote */}
        <footer className="mt-8 border-t border-slate-900 pt-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
          <div className="flex items-center space-x-1.5">
            <Globe className="w-3.5 h-3.5 text-slate-600" />
            <span>End-to-End Encrypted Tunnel active — ISO 27001 Certified SOC2 Compliant</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-900">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Click preset scenarios to test verification success, tampering detection, and document recency limits.</span>
          </div>
        </footer>
      </main>

    </div>
  );
}
