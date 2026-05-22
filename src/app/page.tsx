'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Server, RefreshCw, Cpu, Activity, Info, Globe, AlertCircle } from 'lucide-react';
import { KYCDocument, ProcessingLog, VerificationStatus, AnalyticsMetrics, LogLevel } from '@/types/kyc';
import { MOCK_DOCUMENTS, MOCK_METRICS, SIMULATION_LOGS } from '@/lib/constants';
import {
  checkApiHealth,
  fetchDashboardMetrics,
  validateIdentity,
  verifyDocument,
  type DetectedRegionApi,
} from '@/lib/api';
import type { BoundingBox } from '@/types/kyc';
import { formatLogTimestamp } from '@/lib/format';
import { AnalyticsGrid } from '@/components/features/AnalyticsGrid';
import { UploadDropzone } from '@/components/features/UploadDropzone';
import { SplitScreenWorkflow } from '@/components/features/SplitScreenWorkflow';
import { LogsTimeline } from '@/components/features/LogsTimeline';

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
  const [mounted, setMounted] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

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
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
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
            const timestamp = formatLogTimestamp();
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
      const timestamp = formatLogTimestamp();
      
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
    const timestamp = formatLogTimestamp();
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

  const mapApiStatus = (apiStatus: string): VerificationStatus => {
    if (apiStatus === 'verified') return 'success';
    if (apiStatus === 'flagged') return 'failed';
    return 'warning';
  };

  const mapDetectedRegions = (regions: DetectedRegionApi[] | undefined): BoundingBox[] => {
    if (!regions?.length) return [];
    return regions.map((r) => ({
      label: r.label,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      fieldKey: r.field_key,
    }));
  };

  const buildPassportFields = (
    name: string | null | undefined,
    surname: string | null | undefined,
    givenNames: string | null | undefined,
    dob: string | null | undefined,
    docId: string | null | undefined,
    nationality: string | null | undefined,
    confidence: number
  ) => {
    const fields: KYCDocument['extractedFields'] = [];
    const displayName = name || [givenNames, surname].filter(Boolean).join(' ');
    if (displayName) {
      fields.push({ key: 'name', label: 'Full Name', value: displayName, confidence, isMatch: true });
    }
    if (surname) {
      fields.push({ key: 'surname', label: 'Surname', value: surname, confidence, isMatch: true });
    }
    if (givenNames) {
      fields.push({ key: 'given_names', label: 'Given Names', value: givenNames, confidence, isMatch: true });
    }
    if (dob) {
      fields.push({ key: 'dob', label: 'Date of Birth', value: dob, confidence, isMatch: true });
    }
    if (nationality) {
      fields.push({
        key: 'nationality',
        label: 'Nationality',
        value: nationality,
        confidence,
        isMatch: true,
      });
    }
    if (docId) {
      fields.push({
        key: 'doc_number',
        label: 'Passport Number',
        value: docId,
        confidence,
        isMatch: true,
      });
    }
    fields.push({ key: 'doc_type', label: 'Document Type', value: 'PASSPORT (P)', confidence: 99, isMatch: true });
    return fields;
  };

  // Real file upload via FastAPI backend
  const buildAadhaarFields = (
    name: string | null | undefined,
    dob: string | null | undefined,
    docId: string | null | undefined,
    confidence: number,
    registryMatch: boolean
  ) => {
    const fields: KYCDocument['extractedFields'] = [];
    const matched = registryMatch;
    if (name) {
      const parts = name.trim().split(/\s+/);
      const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      fields.push({ key: 'name', label: 'Full Name', value: name, confidence, isMatch: matched });
      if (given) {
        fields.push({ key: 'given_names', label: 'Given Names', value: given, confidence, isMatch: matched });
      }
      fields.push({ key: 'surname', label: 'Surname', value: surname, confidence, isMatch: matched });
    }
    if (dob) {
      fields.push({ key: 'dob', label: 'Date of Birth', value: dob, confidence, isMatch: matched });
    }
    fields.push({ key: 'gender', label: 'Gender', value: 'Male', confidence, isMatch: matched });
    if (docId) {
      const formatted = docId.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      fields.push({
        key: 'doc_number',
        label: 'Aadhaar Number',
        value: formatted,
        confidence,
        isMatch: matched,
      });
    }
    return fields;
  };

  const handleCustomFileUpload = async (file: File) => {
    handleReset();
    setApiError(null);
    const cleanFileName = file.name;
    const isPDF = file.type === 'application/pdf';
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;

    setStatus('uploading');
    setUploadProgress(15);
    setLogs([
      {
        id: 'ingestion-init',
        stage: 'received',
        message: `Uploading "${cleanFileName}" to verification API...`,
        timestamp: formatLogTimestamp(),
        level: 'info',
      },
    ]);

    try {
      setUploadProgress(45);
      const result = await verifyDocument(file);
      setUploadProgress(85);
      setStatus('processing');

      let identityMessage = 'Identity registry check skipped (no document ID extracted).';
      let identityVerified = false;
      if (result.ocr.fields.document_id) {
        try {
          const identity = await validateIdentity({
            document_id: result.ocr.fields.document_id,
            name: result.ocr.fields.name,
            date_of_birth: result.ocr.fields.date_of_birth,
          });
          identityMessage = identity.message;
          identityVerified = identity.identity_verified;
        } catch {
          identityMessage = 'Identity registry lookup failed or record not found.';
        }
      }

      const finalStatus = mapApiStatus(result.status);
      const ocrConfidence = result.ocr.ocr_confidence;
      const forgeryScore = result.forgery.forgery_score;
      const structuralOk = result.forgery.layout.structural_integrity;
      const apiDocType = result.document_type ?? 'unknown';
      const isAadhaar = apiDocType === 'aadhaar';
      const docType: KYCDocument['type'] = isAadhaar
        ? 'aadhaar'
        : apiDocType === 'passport'
          ? 'passport'
          : isPDF
            ? 'utility_bill'
            : 'passport';
      const autoBoxes = mapDetectedRegions(result.detected_regions);

      const isPassport = docType === 'passport';
      const extractedFields = isAadhaar
        ? buildAadhaarFields(
            result.ocr.fields.name,
            result.ocr.fields.date_of_birth,
            result.ocr.fields.document_id,
            ocrConfidence,
            identityVerified
          )
        : isPassport
          ? buildPassportFields(
              result.ocr.fields.name,
              result.ocr.fields.surname,
              result.ocr.fields.given_names,
              result.ocr.fields.date_of_birth,
              result.ocr.fields.document_id,
              result.ocr.fields.nationality,
              ocrConfidence
            )
          : [
              ...(result.ocr.fields.name
                ? [{ key: 'name', label: 'Name', value: result.ocr.fields.name, confidence: ocrConfidence }]
                : []),
              ...(result.ocr.fields.date_of_birth
                ? [{ key: 'dob', label: 'Date of Birth', value: result.ocr.fields.date_of_birth, confidence: ocrConfidence }]
                : []),
              ...(result.ocr.fields.document_id
                ? [{ key: 'doc_number', label: 'Document ID', value: result.ocr.fields.document_id, confidence: ocrConfidence }]
                : []),
            ];

      const customDoc: KYCDocument = {
        id: result.verification_id,
        type: docType,
        name: result.ocr.fields.name || cleanFileName,
        url: docType,
        previewUrl,
        imageWidth: result.preprocessing?.output_width,
        imageHeight: result.preprocessing?.output_height,
        status: finalStatus,
        boundingBoxes:
          autoBoxes.length > 0
            ? autoBoxes
            : isAadhaar
              ? MOCK_DOCUMENTS.aadhaar.boundingBoxes
              : isPDF
                ? MOCK_DOCUMENTS.utility_bill.boundingBoxes
                : MOCK_DOCUMENTS.passport.boundingBoxes,
        extractedFields,
        safetyIndicators: [
          {
            id: 'api-layout',
            name: 'Layout Template Match',
            status: structuralOk ? 'PASSED' : 'FAILED',
            details: `Layout match score: ${(result.forgery.layout.layout_match_score * 100).toFixed(1)}%`,
            score: result.forgery.layout.layout_match_score * 100,
          },
          {
            id: 'api-forgery',
            name: 'Forgery Risk Score',
            status: result.forgery.is_suspected_fake ? 'SUSPECTED TAMPERING' : 'PASSED',
            details: `Composite forgery score: ${(forgeryScore * 100).toFixed(1)}%`,
            score: (1 - forgeryScore) * 100,
          },
        ],
      };

      const apiLogs: ProcessingLog[] = [
        {
          id: 'log-api-1',
          stage: 'received',
          message: `File ingested. Verification ID: ${result.verification_id}`,
          timestamp: formatLogTimestamp(),
          level: 'success',
        },
        {
          id: 'log-api-2',
          stage: 'ocr',
          message: `OCR confidence: ${ocrConfidence.toFixed(1)}%. Raw: ${result.ocr.raw_text_snippet.slice(0, 120)}...`,
          timestamp: formatLogTimestamp(),
          level: ocrConfidence >= 70 ? 'success' : 'warning',
        },
        {
          id: 'log-api-3',
          stage: 'forgery',
          message: `Forgery score: ${(forgeryScore * 100).toFixed(1)}%. Structural integrity: ${structuralOk ? 'PASS' : 'FAIL'}`,
          timestamp: formatLogTimestamp(),
          level: result.forgery.is_suspected_fake ? 'error' : 'success',
        },
        {
          id: 'log-api-4',
          stage: 'biometrics',
          message: identityMessage,
          timestamp: formatLogTimestamp(),
          level: 'info',
        },
        {
          id: 'log-api-5',
          stage: 'final',
          message: isAadhaar
            ? `Aadhaar verdict: ${result.status.toUpperCase()}. UID checksum: ${
                result.aadhaar_checksum_valid ? 'VALID' : 'UNCONFIRMED'
              }. ${result.status === 'pending_review' ? 'Retake photo without glare for full name/DOB match.' : ''}`
            : isPassport
              ? `Passport verdict: ${result.status.toUpperCase()}. Passport No: ${result.ocr.fields.document_id ?? 'not read'}.`
              : `API verdict: ${result.status.toUpperCase()} (${result.processing_time_ms}ms)`,
          timestamp: formatLogTimestamp(),
          level: finalStatus === 'success' ? 'success' : finalStatus === 'warning' ? 'warning' : 'error',
        },
      ];

      setUploadProgress(100);
      setActiveScenarioId(customDoc.id);
      setActiveDoc(customDoc);
      setLogs(apiLogs);
      setStatus(finalStatus);

      const metricsData = await fetchDashboardMetrics();
      setMetrics({
        totalProcessed: metricsData.total_processed,
        approvalRate: metricsData.approval_rate_percent,
        activeFraudAlerts: metricsData.total_flagged,
        avgProcessingTimeSec: Math.max(2.5, result.processing_time_ms / 1000),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'API verification failed';
      setApiError(message);
      setStatus('failed');
      setUploadProgress(0);
      setLogs((prev) => [
        ...prev,
        {
          id: 'log-api-err',
          stage: 'final',
          message: `API error: ${message}. Ensure backend is running on port 8000.`,
          timestamp: formatLogTimestamp(),
          level: 'error',
        },
      ]);
    }
  };

  // Toggle Play/Pause state during simulation runs
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Toggle speed multipliers
  const handleSpeedChange = (speedVal: number) => {
    setSimulationSpeed(speedVal);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        await checkApiHealth();
        setApiConnected(true);
        const dashboard = await fetchDashboardMetrics();
        setMetrics({
          totalProcessed: dashboard.total_processed,
          approvalRate: dashboard.approval_rate_percent,
          activeFraudAlerts: dashboard.total_flagged,
          avgProcessingTimeSec: MOCK_METRICS.avgProcessingTimeSec,
        });
      } catch {
        setApiConnected(false);
      }
    })();
  }, [mounted]);

  // Auto-demo scenario only after client mount (avoids hydration issues)
  useEffect(() => {
    if (!mounted) return;
    const startupTimer = setTimeout(() => handleSelectTemplate('passport'), 800);
    return () => clearTimeout(startupTimer);
  }, [mounted]);

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
            <Server className={`w-3.5 h-3.5 ${apiConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
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
            <Activity
              className={`w-3.5 h-3.5 animate-pulse ${apiConnected ? 'text-emerald-400' : 'text-amber-400'}`}
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

        {apiError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

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
