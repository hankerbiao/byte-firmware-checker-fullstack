import React from 'react';
import { ShieldCheck, Zap, FileText, Package, Database } from 'lucide-react';
import { CheckStatus } from './types';

export const CATEGORY_ICONS = {
  '目录结构': React.createElement(Package, { size: 16 }),
  '命名规范': React.createElement(FileText, { size: 16 }),
  '升级工具': React.createElement(Zap, { size: 16 }),
  '完整性': React.createElement(Database, { size: 16 }),
  '智能分析': React.createElement(ShieldCheck, { size: 16 }),
} as const;

export const STATUS_LABELS = {
  [CheckStatus.PASS]: '合规',
  [CheckStatus.WARNING]: '建议修正',
  [CheckStatus.FAIL]: '不合规',
  [CheckStatus.PENDING]: '检测中',
} as const;

export const MOCK_REPORT_META = {
  productName: 'Alpha-Core 企业级服务器',
  version: 'v5.2.0-LTS 稳定版',
} as const;
