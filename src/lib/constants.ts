import { KYCDocument, AnalyticsMetrics, ProcessingLog } from '@/types/kyc';

export const MOCK_METRICS: AnalyticsMetrics = {
  totalProcessed: 1420,
  approvalRate: 94.2,
  activeFraudAlerts: 8,
  avgProcessingTimeSec: 4.8,
};

export const MOCK_DOCUMENTS: Record<string, KYCDocument> = {
  passport: {
    id: 'doc-passport-001',
    type: 'passport',
    name: 'United States Passport',
    url: 'passport', // Identifier for custom SVG renderer
    status: 'success',
    boundingBoxes: [
      { label: 'Document Type', x: 5, y: 5, width: 20, height: 10, fieldKey: 'doc_type' },
      { label: 'Document Number', x: 70, y: 5, width: 25, height: 10, fieldKey: 'doc_number' },
      { label: 'Surname', x: 35, y: 22, width: 40, height: 10, fieldKey: 'surname' },
      { label: 'Given Names', x: 35, y: 34, width: 45, height: 10, fieldKey: 'given_names' },
      { label: 'Nationality', x: 35, y: 46, width: 30, height: 8, fieldKey: 'nationality' },
      { label: 'Date of Birth', x: 35, y: 56, width: 35, height: 8, fieldKey: 'dob' },
      { label: 'Date of Expiry', x: 35, y: 66, width: 35, height: 8, fieldKey: 'expiry_date' },
      { label: 'Portrait Photo', x: 5, y: 22, width: 26, height: 50, fieldKey: 'portrait' },
      { label: 'Machine Readable Zone', x: 5, y: 80, width: 90, height: 15, fieldKey: 'mrz' },
    ],
    extractedFields: [
      { key: 'doc_type', label: 'Document Type', value: 'PASSPORT (P)', confidence: 99.8 },
      { key: 'doc_number', label: 'Document Number', value: 'P98421098', confidence: 99.9, isMatch: true },
      { key: 'surname', label: 'Surname', value: 'HARRINGTON', confidence: 99.7 },
      { key: 'given_names', label: 'Given Names', value: 'SARAH ELIZABETH', confidence: 99.8 },
      { key: 'nationality', label: 'Nationality', value: 'UNITED STATES (USA)', confidence: 99.9 },
      { key: 'dob', label: 'Date of Birth', value: '14 OCT 1992', confidence: 99.5, isMatch: true },
      { key: 'expiry_date', label: 'Date of Expiry', value: '18 FEB 2032', confidence: 99.2, isMatch: true },
    ],
    safetyIndicators: [

      { id: 'ind-2', name: 'MRZ Validation', status: 'PASSED', details: 'Checksum digits match OCR extracted fields.', score: 100 },
      { id: 'ind-3', name: 'Hologram & Optical Security', status: 'PASSED', details: 'Guilloche pattern and microprinting lines verified.' },
      { id: 'ind-4', name: 'Substrate & Paper Quality', status: 'PASSED', details: 'IR/UV reflectance falls within standard parameters.' },
    ]
  },
  license: {
    id: 'doc-license-002',
    type: 'license',
    name: "Driver's License",
    url: 'license',
    status: 'warning',
    boundingBoxes: [
      { label: 'State Identifier', x: 10, y: 4, width: 80, height: 12, fieldKey: 'state' },
      { label: 'License Number', x: 36, y: 22, width: 50, height: 10, fieldKey: 'doc_number' },
      { label: 'Full Name', x: 36, y: 35, width: 50, height: 12, fieldKey: 'full_name' },
      { label: 'Address', x: 36, y: 50, width: 50, height: 14, fieldKey: 'address' },
      { label: 'Date of Birth', x: 36, y: 66, width: 25, height: 8, fieldKey: 'dob' },
      { label: 'Date of Expiry', x: 65, y: 66, width: 25, height: 8, fieldKey: 'expiry_date' },
      { label: 'Portrait Photo', x: 6, y: 22, width: 25, height: 45, fieldKey: 'portrait' },
      { label: 'Signature overlay', x: 6, y: 72, width: 25, height: 15, fieldKey: 'signature' },
    ],
    extractedFields: [
      { key: 'state', label: 'Issuing Authority', value: 'CALIFORNIA (CA) DMV', confidence: 99.2 },
      { key: 'doc_number', label: 'License Number', value: 'DL88210344', confidence: 97.4, isMatch: true },
      { key: 'full_name', label: 'Full Name', value: 'MARCUS AURELIUS', confidence: 98.9 },
      { key: 'address', label: 'Address', value: '452 VISTA GRANDE, LOS ALTOS, CA 94024', confidence: 95.8 },
      { key: 'dob', label: 'Date of Birth', value: '26 APR 1980', confidence: 64.2, isMatch: false },
      { key: 'expiry_date', label: 'Date of Expiry', value: '26 APR 2028', confidence: 99.0, isMatch: true },
    ],
    safetyIndicators: [

      { id: 'ind-6', name: 'Font Tamper Check', status: 'SUSPECTED TAMPERING', details: 'Discrepancy detected in font sizing and character alignment in the Date of Birth field.', score: 45 },
      { id: 'ind-7', name: 'Holographic Overlay', status: 'PASSED', details: 'California Bear outline and DMV text verified.' },
      { id: 'ind-8', name: 'Cross-Database Validation', status: 'FAILED', details: 'Date of birth does not match CA DMV records for license DL88210344.' },
    ]
  },
  pan: {
    id: 'doc-pan-template',
    type: 'pan',
    name: 'PAN Card',
    url: 'pan',
    status: 'success',
    boundingBoxes: [
      { label: 'Photo', x: 4, y: 12, width: 20, height: 58, fieldKey: 'portrait' },
      { label: 'Name', x: 24, y: 14, width: 72, height: 14, fieldKey: 'name' },
      { label: "Father's Name", x: 24, y: 30, width: 72, height: 12, fieldKey: 'given_names' },
      { label: 'Date of Birth', x: 24, y: 44, width: 38, height: 10, fieldKey: 'dob' },
      { label: 'PAN Number', x: 24, y: 58, width: 72, height: 14, fieldKey: 'doc_number' },
    ],
    extractedFields: [
      { key: 'name', label: 'Full Name', value: 'Rajesh Kumar Sharma', confidence: 96, isMatch: true },
      { key: 'given_names', label: "Father's Name", value: 'Kumar Sharma', confidence: 94, isMatch: true },
      { key: 'dob', label: 'Date of Birth', value: '15/08/1985', confidence: 95, isMatch: true },
      { key: 'doc_number', label: 'PAN Number', value: 'ABCPK 1234 F', confidence: 99, isMatch: true },
    ],
    safetyIndicators: [
      { id: 'pan-1', name: 'PAN Format Validation', status: 'PASSED', details: 'Valid 10-character PAN structure.', score: 100 },
      { id: 'pan-2', name: 'Income Tax Registry', status: 'PASSED', details: 'PAN verified against mock registry.', score: 98 },
    ],
  },
  aadhaar: {
    id: 'doc-aadhaar-template',
    type: 'aadhaar',
    name: 'Aadhaar Card',
    url: 'aadhaar',
    status: 'success',
    boundingBoxes: [
      { label: 'Full Document', x: 1, y: 1, width: 98, height: 98, fieldKey: 'full_document' },
      { label: 'Aadhaar Letter (UID section)', x: 2, y: 2, width: 96, height: 48, fieldKey: 'letter_section' },
      { label: 'ID Card — Photo', x: 3, y: 50, width: 28, height: 40, fieldKey: 'portrait' },
      { label: 'ID Card — Name · DOB · Gender', x: 32, y: 50, width: 40, height: 40, fieldKey: 'identity_details' },
      { label: 'ID Card — QR Code', x: 74, y: 50, width: 24, height: 40, fieldKey: 'qr_code' },
      { label: 'Aadhaar Number', x: 3, y: 86, width: 94, height: 11, fieldKey: 'doc_number' },
    ],
    extractedFields: [],
    safetyIndicators: [],
  },
  utility_bill: {
    id: 'doc-bill-003',
    type: 'utility_bill',
    name: 'Utility Bill (Proof of Address)',
    url: 'utility_bill',
    status: 'failed',
    boundingBoxes: [
      { label: 'Provider Logo', x: 6, y: 6, width: 35, height: 12, fieldKey: 'provider' },
      { label: 'Statement Date', x: 65, y: 6, width: 30, height: 10, fieldKey: 'statement_date' },
      { label: 'Customer Name', x: 8, y: 26, width: 45, height: 10, fieldKey: 'customer_name' },
      { label: 'Service Address', x: 8, y: 38, width: 55, height: 14, fieldKey: 'address' },
      { label: 'Account Number', x: 65, y: 26, width: 30, height: 10, fieldKey: 'account_number' },
      { label: 'Amount Due', x: 65, y: 45, width: 30, height: 14, fieldKey: 'amount_due' },
    ],
    extractedFields: [
      { key: 'provider', label: 'Service Provider', value: 'CONSOLIDATED EDISON', confidence: 99.4 },
      { key: 'statement_date', label: 'Statement Date', value: '12 JAN 2025', confidence: 99.1, isMatch: false },
      { key: 'customer_name', label: 'Customer Name', value: 'ROBERT JOHNSON', confidence: 98.7 },
      { key: 'address', label: 'Service Address', value: '789 E 10TH ST APT 4B, NEW YORK, NY 10009', confidence: 97.5, isMatch: false },
      { key: 'account_number', label: 'Account Number', value: '99-8877-6655-1', confidence: 99.5 },
      { key: 'amount_due', label: 'Amount Due', value: '$184.20', confidence: 99.9 },
    ],
    safetyIndicators: [
      { id: 'ind-9', name: 'Document Recency Check', status: 'FAILED', details: 'Document dated 12 JAN 2025 exceeds the 90-day threshold from today (22 MAY 2026).' },
      { id: 'ind-10', name: 'Address Consistency Check', status: 'FAILED', details: 'Extracted address does not match applicant profile (123 Main St, New York, NY).' },
      { id: 'ind-11', name: 'Digital Metadata Integrity', status: 'PASSED', details: 'No editing software signatures found in PDF metadata.' },
    ]
  }
};

export const SIMULATION_LOGS: Record<string, Omit<ProcessingLog, 'timestamp'>[]> = {
  passport: [
    { id: 'log-1', stage: 'received', message: 'Document file "passport_sarah_harrington.png" successfully uploaded to ingestion endpoint.', level: 'success' },
    { id: 'log-2', stage: 'ocr', message: 'OCR engines started: Tesseract OCR + Google Vision API routing.', level: 'info' },
    { id: 'log-3', stage: 'ocr', message: 'OCR extraction successful: 98.7% average character confidence.', level: 'success' },
    { id: 'log-4', stage: 'alignment', message: 'Bounding box alignment matched US Passport Spec V3.4.', level: 'success' },
    { id: 'log-5', stage: 'forgery', message: 'Running forgery check: Analysis of Guilloche grid patterns, micro-text lines, and ink bleed vectors...', level: 'info' },
    { id: 'log-6', stage: 'forgery', message: 'Security patterns verified. Hologram light diffraction checks passed. No digital editing traces detected.', level: 'success' },

    { id: 'log-9', stage: 'final', message: 'KYC Document Verification PASSED. Auto-routing to active customer directory.', level: 'success' }
  ],
  license: [
    { id: 'log-1', stage: 'received', message: 'Document file "marcus_license_ca.jpg" successfully uploaded to ingestion endpoint.', level: 'success' },
    { id: 'log-2', stage: 'ocr', message: 'OCR engines started: Mobile-optimized regional OCR modules.', level: 'info' },
    { id: 'log-3', stage: 'ocr', message: 'OCR extraction complete: Mismatch detected in raw text stream compared to standard font outlines.', level: 'warning' },
    { id: 'log-4', stage: 'alignment', message: 'Bounding box alignment complete (California DL 2020 layout). State headings matched.', level: 'success' },
    { id: 'log-5', stage: 'forgery', message: 'Running forgery check: Scan for font size deviations and character spacing variations...', level: 'info' },
    { id: 'log-6', stage: 'forgery', message: 'ALERT: Font inconsistency detected in field [Date of Birth] (confidence score: 45%). Character height mismatch of 0.8px suggests text modification.', level: 'error' },

    { id: 'log-9', stage: 'final', message: 'VERDICT: WARNING (SUSPECTED TAMPERING). Routing document to manual QA review queue.', level: 'warning' }
  ],
  utility_bill: [
    { id: 'log-1', stage: 'received', message: 'Document file "utility_bill_jan.pdf" successfully uploaded to ingestion endpoint.', level: 'success' },
    { id: 'log-2', stage: 'ocr', message: 'OCR engines started: PDF structure parsing and character stream mapping.', level: 'info' },
    { id: 'log-3', stage: 'ocr', message: 'OCR extraction successful: Text layout parsed.', level: 'success' },
    { id: 'log-4', stage: 'alignment', message: 'Document classified as Consolidated Edison utility statement.', level: 'info' },
    { id: 'log-5', stage: 'forgery', message: 'Running metadata analysis and signature validation...', level: 'info' },
    { id: 'log-6', stage: 'forgery', message: 'Metadata checks completed: PDF was created by ConEd billing engine directly. Digital integrity verified.', level: 'success' },
    { id: 'log-7', stage: 'forgery', message: 'Validation checks: Verifying address and document issue dates...', level: 'info' },
    { id: 'log-8', stage: 'forgery', message: 'ALERT: Document date (12 JAN 2025) is older than 90 days. Current date: 22 MAY 2026. Document expired.', level: 'error' },
    { id: 'log-9', stage: 'forgery', message: 'ALERT: Extracted address "789 E 10TH ST" does not match registration address "123 Main St".', level: 'error' },
    { id: 'log-10', stage: 'final', message: 'VERDICT: FAILED. Reason: Expired document and Address mismatch. User notified to re-upload.', level: 'error' }
  ]
};
