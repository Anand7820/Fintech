const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000';

export type ApiHealth = {
  status: string;
  service: string;
  version: string;
};

export type VerifyDocumentApiResponse = {
  verification_id: string;
  status: 'verified' | 'flagged' | 'pending_review';
  document_type?: string;
  aadhaar_checksum_valid?: boolean | null;
  ocr: {
    fields: {
      name: string | null;
      date_of_birth: string | null;
      document_id: string | null;
    };
    ocr_confidence: number;
    raw_text_snippet: string;
  };
  forgery: {
    forgery_score: number;
    is_suspected_fake: boolean;
    layout: { structural_integrity: boolean; layout_match_score: number };
  };
  processing_time_ms: number;
};

export type DashboardMetricsApiResponse = {
  total_verified: number;
  total_flagged: number;
  total_pending: number;
  total_processed: number;
  approval_rate_percent: number;
};

export type IdentityValidationApiResponse = {
  document_id: string;
  identity_verified: boolean;
  registry_match_score: number;
  message: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function checkApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${API_BASE}/api/v1/health`, {
    method: 'GET',
    cache: 'no-store',
  });
  return parseJson<ApiHealth>(response);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetricsApiResponse> {
  const response = await fetch(`${API_BASE}/api/v1/dashboard-metrics`, {
    method: 'GET',
    cache: 'no-store',
  });
  return parseJson<DashboardMetricsApiResponse>(response);
}

export async function verifyDocument(file: File): Promise<VerifyDocumentApiResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/v1/verify-document`, {
    method: 'POST',
    body: formData,
  });
  return parseJson<VerifyDocumentApiResponse>(response);
}

export async function validateIdentity(payload: {
  document_id: string;
  name?: string | null;
  date_of_birth?: string | null;
}): Promise<IdentityValidationApiResponse> {
  const response = await fetch(`${API_BASE}/api/v1/validate-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<IdentityValidationApiResponse>(response);
}
