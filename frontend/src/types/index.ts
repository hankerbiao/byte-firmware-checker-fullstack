export enum CheckStatus {
  PASS = 'PASS',
  WARNING = 'WARNING',
  FAIL = 'FAIL',
  PENDING = 'PENDING'
}

export enum FirmwareType {
  BMC = 'BMC',
  BIOS = 'BIOS',
  UNKNOWN = 'UNKNOWN'
}

export interface CheckItem {
  id: string;
  category: string;
  name: string;
  status: CheckStatus;
  description: string;
  suggestion?: string;
  standard?: string;
}

export interface InspectionReport {
  id: string;
  timestamp: string;
  firmwareType: FirmwareType;
  productName: string;
  version: string;
  overallScore: number;
  checks: CheckItem[];
  fileStructure: { path: string; size: string; type: string; hash: string }[];
  trend: { fix: number; new: number };
}

export interface AnalysisSummary {
  total: number;
  pass: number;
  warning: number;
  fail: number;
}