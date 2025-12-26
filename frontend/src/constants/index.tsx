import React from 'react';
import { CheckStatus, CheckItem } from '../types';
import { ShieldCheck, AlertTriangle, XCircle, Clock, Zap, FileText, Package, Database } from 'lucide-react';

export const STATUS_LABELS = {
  [CheckStatus.PASS]: '合规',
  [CheckStatus.WARNING]: '建议修正',
  [CheckStatus.FAIL]: '不合规',
  [CheckStatus.PENDING]: '检测中',
};

export const STATUS_ICONS = {
  [CheckStatus.PASS]: <ShieldCheck className="w-5 h-5 text-green-500" />,
  [CheckStatus.WARNING]: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  [CheckStatus.FAIL]: <XCircle className="w-5 h-5 text-rose-500" />,
  [CheckStatus.PENDING]: <Clock className="w-5 h-5 text-slate-400 animate-pulse" />,
};

export const CATEGORY_ICONS = {
  '目录结构': <Package size={16} />,
  '命名规范': <FileText size={16} />,
  '升级工具': <Zap size={16} />,
  '完整性': <Database size={16} />,
  '智能分析': <ShieldCheck size={16} />,
};

export const MOCK_CHECKLIST: CheckItem[] = [
  { id: '1', category: '目录结构', name: '标准目录层级', status: CheckStatus.PASS, description: '符合通用固件发布规范 V2.0 规定的目录布局。', standard: 'ISO/IEC 20243' },
  { id: '2', category: '目录结构', name: '隐藏文件清理', status: CheckStatus.PASS, description: '未发现系统生成或临时产生的隐藏冗余文件。', standard: 'Common Criteria' },
  { id: '3', category: '命名规范', name: '压缩包命名格式', status: CheckStatus.PASS, description: '符合行业标准命名格式。', standard: 'Internal-Spec' },
  { id: '4', category: '命名规范', name: '全英文命名强制', status: CheckStatus.FAIL, description: '在子文件夹 "Tools" 的深层目录中发现非 ASCII 字符文件名。', suggestion: '请将所有路径下的资源重命名为标准英文。', standard: 'POSIX-Standard' },
  { id: '5', category: '升级工具', name: 'InbUpdateTool 结构检查', status: CheckStatus.PASS, description: '工具包解压后直接呈现可执行脚本。', standard: 'NIST SP 800-147' },
  { id: '6', category: '升级工具', name: '脚本权限校验', status: CheckStatus.WARNING, description: '检测到部分 .sh 脚本权限为 644。', suggestion: '建议提升至 755。', standard: 'Linux-Filesystem' },
  { id: '7', category: '完整性', name: '哈希摘要一致性', status: CheckStatus.PASS, description: 'SHA-256 摘要完全匹配。', standard: 'FIPS 140-2' },
  { id: '8', category: '智能分析', name: '文档模板匹配度', status: CheckStatus.PASS, description: '确认测试报告结构符合合规模板要求。', standard: 'IEEE 829' },
  { id: '9', category: '智能分析', name: '版本演进逻辑', status: CheckStatus.FAIL, description: 'Release Note 缺少 v3.9.1 版本的详情说明。', suggestion: '请补充缺失的版本迭代说明。', standard: 'CMMI Level 3' },
];

export const MOCK_FILES = [
  { path: '/fw/BIOS_CORE_v520.bin', size: '32MB', type: 'Firmware Binary', hash: 'e3b0c442...8b1a' },
  { path: '/tools/FlashTool_v12.zip', size: '124MB', type: 'Utility', hash: 'a591a6d4...c21e' },
  { path: '/docs/testing_summary.pdf', size: '1.2MB', type: 'Document', hash: 'c92d...45e0' },
  { path: '/docs/release_info.md', size: '12KB', type: 'Document', hash: 'f832...a11b' },
  { path: '/logs/boot_sequence.txt', size: '45KB', type: 'Log', hash: 'd0e1...b5c6' },
];