// 后端 API 基础地址：
// - 通过 window.location.hostname 适配不同环境的主机名（本地 / 测试 / 线上）
// - 端口固定为 8000，对应 FastAPI 服务
// - 统一为其他 API 封装函数提供前缀，避免各处硬编码 URL
export const API_BASE_URL = `http://10.2.51.52:8000/api/v1`;

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
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to create audit task');
  }

  return response.json();
}

export async function getAudit(auditId: string): Promise<AuditTask> {
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}`);
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
  const response = await fetch(
    `${API_BASE_URL}/audits${query ? `?${query}` : ''}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch audits');
  }
  return response.json();
}

export async function getAuditLogs(auditId: string, since?: string): Promise<ConsoleLog[]> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}/logs${qs}`);
  if (!response.ok) {
    throw new Error('Failed to fetch audit logs');
  }
  return response.json();
}

export async function getAuditReport(auditId: string): Promise<AuditReportDto> {
  const response = await fetch(`${API_BASE_URL}/audits/${auditId}/report`);
  if (!response.ok) {
    throw new Error('Failed to fetch audit report');
  }
  return response.json();
}
