export type VerificationStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'failed' | 'warning';

export interface BoundingBox {
  label: string;
  x: number;      // percentage from left (0-100)
  y: number;      // percentage from top (0-100)
  width: number;  // width percentage (0-100)
  height: number; // height percentage (0-100)
  fieldKey: string;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0-100
  isMatch?: boolean;  // Cross-reference match (e.g. database or MRZ check)
}

export type SafetyStatus = 'PASSED' | 'SUSPECTED TAMPERING' | 'FAILED';

export interface SafetyIndicator {
  id: string;
  name: string;
  status: SafetyStatus;
  details: string;
  score?: number; // e.g. 0-100 match score
}

export interface KYCDocument {
  id: string;
  type: 'passport' | 'license' | 'utility_bill' | 'aadhaar';
  name: string;
  url: string; // fallback mock or user-uploaded base64/objectURL
  previewUrl?: string; // blob URL of uploaded file (show real scan, not SVG mock)
  /** Natural pixel size of uploaded scan — keeps overlay boxes aligned */
  imageWidth?: number;
  imageHeight?: number;
  status: VerificationStatus;
  boundingBoxes: BoundingBox[];
  extractedFields: ExtractedField[];
  safetyIndicators: SafetyIndicator[];
  rawText?: string;
}

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ProcessingLog {
  id: string;
  stage: string;
  message: string;
  timestamp: string;
  level: LogLevel;
}

export interface AnalyticsMetrics {
  totalProcessed: number;
  approvalRate: number;
  activeFraudAlerts: number;
  avgProcessingTimeSec: number;
}
