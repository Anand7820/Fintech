import { useState, useCallback, useRef, useEffect } from 'react';
import { KYCDocument, ProcessingLog, VerificationStatus, AnalyticsMetrics } from '@/types/kyc';
import { MOCK_DOCUMENTS, MOCK_METRICS, SIMULATION_LOGS } from '@/lib/constants';
import { checkApiHealth, fetchDashboardMetrics, verifyDocument } from '@/lib/api';
import { formatLogTimestamp } from '@/lib/format';
import { useDocumentParser } from './useDocumentParser';

export function useKYCWorkflow() {
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [activeDoc, setActiveDoc] = useState<KYCDocument | null>(null);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(MOCK_METRICS);

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const simulationRef = useRef<{
    logQueue: Omit<ProcessingLog, 'timestamp'>[];
    currentIndex: number;
    currentDoc: KYCDocument;
    isUploading: boolean;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    fieldMatchLookup,
    resolveVerificationStatus,
    mapDetectedRegions,
    buildPassportFields,
    buildPanFields,
    buildLicenseFields,
    buildAadhaarFields,
  } = useDocumentParser();

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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

  const advanceSimulation = useCallback(() => {
    if (!simulationRef.current || isPaused) return;

    const sim = simulationRef.current;

    if (sim.isUploading) {
      setUploadProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 15 + 5) * simulationSpeed;
        if (next >= 100) {
          sim.isUploading = false;
          setStatus('processing');
          if (sim.logQueue.length > 0) {
            const firstLog = sim.logQueue[0];
            setLogs([{ ...firstLog, timestamp: formatLogTimestamp() }]);
            sim.currentIndex = 1;
          }
          return 100;
        }
        return next;
      });
      return;
    }

    if (sim.currentIndex < sim.logQueue.length) {
      const nextLog = sim.logQueue[sim.currentIndex];
      setLogs((prev) => [...prev, { ...nextLog, timestamp: formatLogTimestamp() }]);
      sim.currentIndex += 1;
    } else {
      clearTimers();
      const finalStatus = sim.currentDoc.status;
      setStatus(finalStatus);
      setActiveDoc(sim.currentDoc);

      setMetrics((prev) => {
        const newTotal = prev.totalProcessed + 1;
        let newFraud = prev.activeFraudAlerts;
        let approvalAdjust = prev.approvalRate;

        if (finalStatus === 'success') {
          approvalAdjust = Math.min(99.9, parseFloat((((prev.totalProcessed * prev.approvalRate / 100) + 1) / newTotal * 100).toFixed(1)));
        } else if (finalStatus === 'failed') {
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

  useEffect(() => {
    clearTimers();
    if (status === 'idle' || isPaused) return;
    const baseInterval = status === 'uploading' ? 120 : 800;
    const intervalTime = baseInterval / simulationSpeed;
    timerRef.current = setInterval(advanceSimulation, intervalTime);
    return () => clearTimers();
  }, [status, isPaused, simulationSpeed, advanceSimulation, clearTimers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleSelectTemplate = (type: 'passport' | 'license' | 'utility_bill') => {
    handleReset();
    const docPreset = MOCK_DOCUMENTS[type];
    const logsPreset = SIMULATION_LOGS[type];
    if (!docPreset || !logsPreset) return;

    const initialLog: ProcessingLog = {
      id: 'ingestion-init',
      stage: 'received',
      message: `System connecting to ingestion stream. Incoming ${type.toUpperCase()} file detected...`,
      timestamp: formatLogTimestamp(),
      level: 'info'
    };

    simulationRef.current = {
      logQueue: logsPreset,
      currentIndex: 0,
      currentDoc: docPreset,
      isUploading: true
    };

    setActiveScenarioId(docPreset.id);
    setActiveDoc({ ...docPreset, status: 'processing' });
    setLogs([initialLog]);
    setStatus('uploading');
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
    setLogs([{
      id: 'ingestion-init',
      stage: 'received',
      message: `Uploading "${cleanFileName}" to verification API...`,
      timestamp: formatLogTimestamp(),
      level: 'info',
    }]);

    try {
      setUploadProgress(45);
      const result = await verifyDocument(file);
      setUploadProgress(85);
      setStatus('processing');

      const identityVerified = result.identity_verified ?? false;
      const matchMap = fieldMatchLookup(result.field_matches);
      let identityMessage = 'Identity registry check skipped (no document ID extracted).';
      if (result.ocr.fields.document_id) {
        if (identityVerified) {
          identityMessage = 'Identity verified against core registry.';
        } else if (result.field_matches?.length) {
          const failed = result.field_matches.filter((f) => !f.match).map((f) => f.field);
          identityMessage = failed.length > 0
            ? `Registry mismatch on: ${failed.join(', ')}. Overall verification not passed.`
            : 'Identity could not be verified against registry.';
        } else {
          identityMessage = 'Document ID not found in identity registry.';
        }
      }

      const ocrConfidence = result.ocr.ocr_confidence;
      const forgeryScore = result.forgery.forgery_score;
      const structuralOk = result.forgery.layout.structural_integrity;
      const apiDocType = result.document_type ?? 'unknown';
      const isAadhaar = apiDocType === 'aadhaar';
      const isPan = apiDocType === 'pan';
      const isLicense = apiDocType === 'license';
      const docType: KYCDocument['type'] = isAadhaar ? 'aadhaar'
        : isPan ? 'pan'
        : apiDocType === 'passport' ? 'passport'
        : isLicense ? 'license'
        : isPDF ? 'utility_bill' : 'passport';

      const autoBoxes = mapDetectedRegions(result.detected_regions);
      const isPassport = docType === 'passport';

      const extractedFields = isAadhaar
        ? buildAadhaarFields(result.ocr.fields.name, result.ocr.fields.date_of_birth, result.ocr.fields.document_id, ocrConfidence, matchMap, Boolean(result.aadhaar_checksum_valid))
        : isPan
        ? buildPanFields(result.ocr.fields.name, result.ocr.fields.given_names, result.ocr.fields.date_of_birth, result.ocr.fields.document_id, ocrConfidence, matchMap)
        : isLicense
        ? buildLicenseFields(result.ocr.fields.name, result.ocr.fields.date_of_birth, result.ocr.fields.expiry_date, result.ocr.fields.document_id, result.ocr.fields.nationality, ocrConfidence, matchMap)
        : isPassport
        ? buildPassportFields(result.ocr.fields.name, result.ocr.fields.surname, result.ocr.fields.given_names, result.ocr.fields.date_of_birth, result.ocr.fields.document_id, result.ocr.fields.nationality, ocrConfidence, matchMap)
        : [
            ...(result.ocr.fields.name ? [{ key: 'name', label: 'Name', value: result.ocr.fields.name, confidence: ocrConfidence }] : []),
            ...(result.ocr.fields.date_of_birth ? [{ key: 'dob', label: 'Date of Birth', value: result.ocr.fields.date_of_birth, confidence: ocrConfidence }] : []),
            ...(result.ocr.fields.document_id ? [{ key: 'doc_number', label: 'Document ID', value: result.ocr.fields.document_id, confidence: ocrConfidence }] : []),
          ];

      const finalStatus = resolveVerificationStatus(result.status, extractedFields, identityVerified);

      const customDoc: KYCDocument = {
        id: result.verification_id,
        type: docType,
        name: result.ocr.fields.name || cleanFileName,
        url: docType,
        previewUrl,
        mimeType: file.type,
        imageWidth: result.preprocessing?.output_width,
        imageHeight: result.preprocessing?.output_height,
        status: finalStatus,
        boundingBoxes: autoBoxes.length > 0 ? autoBoxes : (isAadhaar ? MOCK_DOCUMENTS.aadhaar.boundingBoxes : isPan ? MOCK_DOCUMENTS.pan.boundingBoxes : isLicense ? MOCK_DOCUMENTS.license.boundingBoxes : isPDF ? MOCK_DOCUMENTS.utility_bill.boundingBoxes : MOCK_DOCUMENTS.passport.boundingBoxes),
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
        { id: 'log-api-1', stage: 'received', message: `File ingested. Verification ID: ${result.verification_id}`, timestamp: formatLogTimestamp(), level: 'success' },
        { id: 'log-api-2', stage: 'ocr', message: `OCR confidence: ${ocrConfidence.toFixed(1)}%. Raw: ${result.ocr.raw_text_snippet.slice(0, 120)}...`, timestamp: formatLogTimestamp(), level: ocrConfidence >= 70 ? 'success' : 'warning' },
        { id: 'log-api-3', stage: 'forgery', message: `Forgery score: ${(forgeryScore * 100).toFixed(1)}%. Structural integrity: ${structuralOk ? 'PASS' : 'FAIL'}`, timestamp: formatLogTimestamp(), level: result.forgery.is_suspected_fake ? 'error' : 'success' },
        { id: 'log-api-4', stage: 'biometrics', message: identityMessage, timestamp: formatLogTimestamp(), level: 'info' },
        { id: 'log-api-5', stage: 'final', message: isAadhaar ? `Aadhaar verdict: ${result.status.toUpperCase()}. UID checksum: ${result.aadhaar_checksum_valid ? 'VALID' : 'UNCONFIRMED'}.` : `API verdict: ${result.status.toUpperCase()} (${result.processing_time_ms}ms)`, timestamp: formatLogTimestamp(), level: finalStatus === 'success' ? 'success' : finalStatus === 'warning' ? 'warning' : 'error' },
      ];

      if (finalStatus !== 'success') {
        apiLogs.push({ id: 'log-api-6', stage: 'final', message: 'Overall status downgraded: one or more field checks failed.', timestamp: formatLogTimestamp(), level: 'warning' });
      }

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
      setLogs((prev) => [...prev, { id: 'log-api-err', stage: 'final', message: `API error: ${message}. Ensure backend is running on port 8000.`, timestamp: formatLogTimestamp(), level: 'error' }]);
    }
  };

  const handleTogglePause = () => setIsPaused((prev) => !prev);
  const handleSpeedChange = (speedVal: number) => setSimulationSpeed(speedVal);

  return {
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
  };
}
