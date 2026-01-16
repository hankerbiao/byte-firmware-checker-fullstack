const DEV_API_BASE_URL = 'http://10.2.51.52:8000/api/v1';
const PROD_API_BASE_URL = '/api/v1';

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ??
  (((import.meta as any).env?.MODE ?? import.meta.env.MODE) === 'development'
    ? DEV_API_BASE_URL
    : PROD_API_BASE_URL);

export type ApiFirmwareType = 'BMC' | 'BIOS' | 'UNKNOWN';
export type BmcType = 'AMI' | 'OpenBMC' | 'Self';

export interface AuditSummary {
  total: number;
  passed: number;
  warning: number;
  failed: number;
}

export interface AuditTask {
  id: string;
  status: 'PENDING' | 'UPLOADING' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
  createdAt?: string;
  completedAt?: string | null;
  firmwareType?: ApiFirmwareType;
  productName?: string;
  version?: string;
  summary?: AuditSummary;
  userId?: string;
  userName?: string;
}

export interface CreateAuditParams {
  file: File;
  firmwareType: ApiFirmwareType;
  bmcType: BmcType;
  /** 由前端选择的检查脚本名称，例如 "CheckFWFile_v1.3.1.py" */
  checkScript?: string;
  productName?: string;
  version?: string;
}

export interface ConsoleLog {
  auditId: string;
  message: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | string;
  meta?: {
    testName?: string;
    step?: number;
  };
}

export interface CheckItemDto {
  auditId: string;
  id: string;
  category: string;
  name: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  description: string;
  standard?: string;
}

export interface AuditReportDto {
  id: string;
  timestamp: string;
  firmwareType: string;
  productName: string;
  version: string;
  summary: AuditSummary;
  checks: CheckItemDto[];
}

export interface AuditListResponse {
  items: AuditTask[];
  total: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
}

export interface OALoginResult {
  ok: boolean;
  user?: unknown;
  next?: string | null;
  token?: string;
}

let sessionToken: string | null = null;

const SESSION_STORAGE_KEY = 'core-audit-session-token';

export function setSessionToken(token: string | null) {
  sessionToken = token;
  try {
    if (token) {
      localStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function restoreSessionTokenFromStorage() {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      sessionToken = stored;
    } else {
      sessionToken = null;
    }
  } catch {
    sessionToken = null;
  }
}

function withAuthHeaders(base: HeadersInit = {}): HeadersInit {
  if (sessionToken) {
    return {
      ...base,
      'X-Session-Token': sessionToken,
    };
  }
  return base;
}

export async function getHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`http://10.2.51.52:8000/health`);
    if (!response.ok) {
      return { status: 'error' };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'error' };
  }
}

export async function getCurrentUser(): Promise<{ sessionId: string | null; itcode: string | null; user: unknown }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error('Failed to fetch current user');
  }
  return response.json();
}

export async function submitOALogin(params: {
  status: string;
  payload: string;
  next: string | null;
}): Promise<OALoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/oa/callback`, {
    method: 'POST',
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'OA login failed');
  }

  return response.json();
}

export async function createAudit(params: CreateAuditParams): Promise<AuditTask> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('firmwareType', params.firmwareType);
  formData.append('bmcType', params.bmcType);

  if (params.checkScript) {
    formData.append('checkScript', params.checkScript);
  }

  if (params.productName) {
    formData.append('productName', params.productName);
  }

  if (params.version) {
    formData.append('version', params.version);
  }

  const response = await fetch(`${API_BASE_URL}/audits`, {
    method: 'POST',
    headers: withAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to create audit task');
  }

  return response.json();
}

export interface ChunkUploadOptions {
  chunkSize?: number;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
}

export async function createAuditChunked(
  params: CreateAuditParams,
  options: ChunkUploadOptions = {},
): Promise<AuditTask> {
  const chunkSize = options.chunkSize ?? 1024 * 1024;
  const totalSize = params.file.size;
  const totalChunks = Math.ceil(totalSize / chunkSize);

  const initResponse = await fetch(`${API_BASE_URL}/audits/chunk-init`, {
    method: 'POST',
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      fileName: params.file.name,
      firmwareType: params.firmwareType,
      bmcType: params.bmcType,
      checkScript: params.checkScript,
      productName: params.productName,
      version: params.version,
      totalSize,
      totalChunks,
      chunkSize,
    }),
  });

  if (!initResponse.ok) {
    throw new Error('Failed to init chunked audit upload');
  }

  const initData: { uploadId: string } = await initResponse.json();
  const uploadId = initData.uploadId;

  let uploadedBytes = 0;

  for (let index = 0; index < totalChunks; index++) {
    const start = index * chunkSize;
    const end = Math.min(totalSize, start + chunkSize);
    const chunk = params.file.slice(start, end);

    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(index));
    formData.append('totalChunks', String(totalChunks));
    formData.append('chunk', chunk);

    const chunkResponse = await fetch(`${API_BASE_URL}/audits/chunk`, {
      method: 'POST',
      headers: withAuthHeaders(),
      body: formData,
    });

    if (!chunkResponse.ok) {
      throw new Error(`Failed to upload chunk ${index + 1}/${totalChunks}`);
    }

    uploadedBytes = end;
    if (options.onProgress) {
      options.onProgress(uploadedBytes, totalSize);
    }
  }

  const completeResponse = await fetch(`${API_BASE_URL}/audits/chunk-complete`, {
    method: 'POST',
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ uploadId }),
  });

  if (!completeResponse.ok) {
    throw new Error('Failed to complete chunked audit upload');
  }

  return completeResponse.json();
}

export async function getAudit(auditId: string): Promise<AuditTask> {
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch audit');
  }
  return response.json();
}

export async function listAudits(params?: {
  status?: string[];
  firmwareType?: ApiFirmwareType;
  limit?: number;
  offset?: number;
}): Promise<AuditListResponse> {
  const qs = new URLSearchParams();

  if (params?.status) {
    params.status.forEach(s => qs.append('status', s));
  }

  if (params?.firmwareType) {
    qs.append('firmwareType', params.firmwareType);
  }

  if (params?.limit) {
    qs.append('limit', String(params.limit));
  }

  if (params?.offset !== undefined) {
    qs.append('offset', String(params.offset));
  }

  const query = qs.toString();
  const response = await fetch(`${API_BASE_URL}/audits${query ? `?${query}` : ''}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error('Failed to fetch audits');
  }
  return response.json();
}

export async function getAuditLogs(auditId: string, since?: string): Promise<ConsoleLog[]> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}/logs${qs}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch audit logs');
  }
  return response.json();
}

export async function getAuditReport(auditId: string): Promise<AuditReportDto> {
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}/report`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch audit report');
  }
  return response.json();
}

export async function downloadAuditReportPdf(auditId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}/report.pdf`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error('Failed to download audit report PDF');
  }
  return response.blob();
}
