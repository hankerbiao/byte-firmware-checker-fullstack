
import React, { useMemo, useState } from 'react';
import { 
  Download, 
  Share2, 
  CheckCircle2, 
  AlertTriangle,
  Terminal,
  Sparkles,
  Layers,
  Search,
  ShieldCheck,
  XCircle,
  Tag,
  ChevronRight
} from 'lucide-react';
import { InspectionReport, CheckStatus, CheckItem } from '../types';
import { CATEGORY_ICONS } from '../constants';
import { API_BASE_URL } from '../api/client';

// --- 类型定义 ---
interface ComplianceReportProps {
  report: InspectionReport;
}

// --- 样式常量 ---
const CARD_STYLE = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-2xl transition-all";
const CIRCLE_CONFIG = {
  R: 100,
  CX: 112,
  CY: 112,
  PERIMETER: 2 * Math.PI * 100 // 约 628.3
};

// --- 子组件: 评分横幅 (ScoreBanner) ---
const ScoreBanner: React.FC<{ report: InspectionReport; stats: { pass: number; warning: number; fail: number } }> = ({ report, stats }) => (
  <div className={`${CARD_STYLE} p-8 md:p-12 rounded-[3.5rem] relative overflow-hidden group mb-10`}>
    <div className="absolute -top-20 -right-20 p-16 opacity-[0.03] dark:opacity-[0.05] group-hover:rotate-45 transition-all duration-[3s] pointer-events-none text-slate-900 dark:text-white">
      <ShieldCheck size={350} />
    </div>
    
    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 relative z-10">
      {/* 评分圆环可视化容器 */}
      <div className="relative w-64 h-64 shrink-0 flex items-center justify-center bg-slate-50/50 dark:bg-white/5 rounded-[3rem] border border-slate-100 dark:border-white/5">
        <svg className="w-56 h-56 transform -rotate-90 overflow-visible">
          <circle cx={CIRCLE_CONFIG.CX} cy={CIRCLE_CONFIG.CY} r={CIRCLE_CONFIG.R} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100 dark:text-white/5" />
          <circle 
            cx={CIRCLE_CONFIG.CX} cy={CIRCLE_CONFIG.CY} r={CIRCLE_CONFIG.R} stroke="currentColor" strokeWidth="16" fill="transparent"
            strokeDasharray={CIRCLE_CONFIG.PERIMETER}
            strokeDashoffset={CIRCLE_CONFIG.PERIMETER - (CIRCLE_CONFIG.PERIMETER * report.overallScore) / 100}
            strokeLinecap="round"
            className={`${report.overallScore >= 90 ? 'text-green-500' : 'text-blue-600'} transition-all duration-[1.5s] ease-out drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-7xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{report.overallScore}</span>
          <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mt-2">Compliance</span>
        </div>
      </div>

      <div className="flex-1 text-center md:text-left space-y-8">
        <div>
          <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
            <span className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20">
              {report.firmwareType} Package
            </span>
          </div>
          <h2 className="text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">{report.productName}</h2>
          <p className="text-lg font-bold text-slate-400 mt-2">版本迭代审计: <span className="text-blue-500">{report.version}</span></p>
        </div>

        <div className="grid grid-cols-3 gap-4 md:gap-6">
          {[
            { label: '合规项', value: stats.pass, color: 'text-green-500' },
            { label: '错误', value: stats.fail, color: 'text-rose-500' },
            { label: '警告', value: stats.warning, color: 'text-amber-500' }
          ].map(item => (
            <div key={item.label} className="p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/5 text-center shadow-sm hover:scale-[1.02] transition-transform">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
              <p className={`text-4xl font-black ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AuditItem: React.FC<{ item: CheckItem }> = ({ item }) => (
  <div className={`${CARD_STYLE} p-8 rounded-[2.5rem] group hover:border-blue-500/30`}>
    <div className="flex items-start justify-between gap-10">
      <div className="flex-1">
        <div className="flex items-center flex-wrap gap-4 mb-4">
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl text-slate-400 group-hover:text-blue-600 transition-colors">
            {CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS] || <Layers size={20} />}
          </div>
          <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{item.name}</h4>
          {item.standard && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-500/20">
               <Tag size={12} /> {item.standard}
            </span>
          )}
        </div>
        <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed font-medium mb-4">{item.description}</p>
        
        {item.suggestion && (
          <div className="p-6 rounded-3xl bg-blue-600/5 dark:bg-blue-500/5 border border-blue-600/10 flex items-start gap-4">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
               <Sparkles size={18} />
            </div>
            <p className="text-sm text-slate-800 dark:text-blue-50 font-bold leading-relaxed">{item.suggestion}</p>
          </div>
        )}
      </div>
      
      <div className={`shrink-0 flex items-center justify-center w-16 h-16 rounded-[2rem] text-white shadow-xl ${
        item.status === CheckStatus.PASS ? 'bg-green-500 shadow-green-500/20' :
        item.status === CheckStatus.WARNING ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'
      }`}>
        {item.status === CheckStatus.PASS && <CheckCircle2 size={32} />}
        {item.status === CheckStatus.WARNING && <AlertTriangle size={32} />}
        {item.status === CheckStatus.FAIL && <XCircle size={32} />}
      </div>
    </div>
  </div>
);

interface EvidenceShareModalProps {
  report: InspectionReport;
  checks: CheckItem[];
  onClose: () => void;
}

const EvidenceShareModal: React.FC<EvidenceShareModalProps> = ({ report, checks, onClose }) => {
  const [copied, setCopied] = useState(false);

  const evidenceText = useMemo(() => {
    const headerLines = [
      '【固件合规审计问题证据链】',
      '',
      `产品: ${report.productName}`,
      `版本: ${report.version}`,
      `固件类型: ${report.firmwareType}`,
      `审计时间: ${report.timestamp}`,
      `审计任务ID: ${report.id}`,
      '',
    ];

    const mapStatusLabel = (status: CheckStatus) => {
      if (status === CheckStatus.FAIL) return '错误';
      if (status === CheckStatus.WARNING) return '警告';
      if (status === CheckStatus.PASS) return '通过';
      if (status === CheckStatus.PENDING) return '待确认';
      return status;
    };

    const itemsLines = checks.map((item, index) => {
      const lines = [];
      const statusLabel = mapStatusLabel(item.status);
      lines.push(`${index + 1}. [${statusLabel}] ${item.category} - ${item.name}`);
      if (item.standard) {
        lines.push(`   规则标准: ${item.standard}`);
      }
      lines.push(`   问题描述: ${item.description}`);
      if (item.suggestion) {
        lines.push(`   整改建议: ${item.suggestion}`);
      }
      return lines.join('\n');
    });

    return [...headerLines, ...itemsLines].join('\n');
  }, [report, checks]);

  const handleCopy = async () => {
    const doFallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = evidenceText;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', 'true');
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const ok = document.execCommand('copy');
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }
      } finally {
        document.body.removeChild(textarea);
      }
    };

    const navAny = navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } };

    if (window.isSecureContext && navAny.clipboard && typeof navAny.clipboard.writeText === 'function') {
      try {
        await navAny.clipboard.writeText(evidenceText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        doFallbackCopy();
        return;
      }
    }

    doFallbackCopy();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-8 py-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
              问题证据链
            </p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
              警告与错误项精简视图
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-95"
            >
              {copied ? '已复制' : '复制文本'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-95"
            >
              关闭
            </button>
          </div>
        </div>

        <div className="px-8 py-6 border-b border-slate-200 dark:border-white/10 flex flex-wrap gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          <span className="px-3 py-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            {report.productName}
          </span>
          <span className="px-3 py-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            版本 {report.version}
          </span>
          <span className="px-3 py-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            {report.firmwareType}
          </span>
          <span className="px-3 py-1 rounded-2xl bg-slate-100 dark:bg:white/5 border border-slate-200 dark:border-white/10">
            更新时间 {report.timestamp}
          </span>
          <span className="px-3 py-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            共 {checks.length} 条问题
          </span>
        </div>

        <div className="px-8 py-6 flex-1 overflow-auto bg-slate-50/60 dark:bg-slate-950">
          {checks.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                当前审计无警告或错误项
              </p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono text-slate-800 dark:text-slate-100">
              {evidenceText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

const ComplianceReport: React.FC<ComplianceReportProps> = ({ report }) => {
  const [filter, setFilter] = useState<'all' | 'fail' | 'warn'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  // 导出完整审计报告为 PDF：
  // - 依赖后端 /audits/{id}/report.pdf 接口
  // - 使用当前报告的 id 拼接 URL，通过 window.open 打开新标签页
  // - 浏览器行为可能是直接预览或触发下载，取决于用户设置
  const handleExportPdf = () => {
    if (!report.id) return;
    const url = `${API_BASE_URL}/audits/${report.id}/report.pdf`;
    window.open(url, '_blank');
  };

  // 性能优化：使用 useMemo 缓存统计数据和过滤后的列表
  const stats = useMemo(() => ({
    pass: report.checks.filter(c => c.status === CheckStatus.PASS).length,
    warning: report.checks.filter(c => c.status === CheckStatus.WARNING).length,
    fail: report.checks.filter(c => c.status === CheckStatus.FAIL).length
  }), [report.checks]);

  const evidenceChecks = useMemo(
    () => report.checks.filter(c => c.status === CheckStatus.WARNING || c.status === CheckStatus.FAIL),
    [report.checks]
  );

  const filteredChecks = useMemo(() => {
    return report.checks.filter(c => {
      const matchesFilter = 
        filter === 'all' || 
        (filter === 'fail' && c.status === CheckStatus.FAIL) || 
        (filter === 'warn' && c.status === CheckStatus.WARNING);
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (c.standard?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      return matchesFilter && matchesSearch;
    });
  }, [report.checks, filter, searchTerm]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-24">
      {/* 左侧主要内容区 */}
      <div className="lg:col-span-8 space-y-10">
        <ScoreBanner report={report} stats={stats} />

        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-4 tracking-tight uppercase">
              <Terminal size={28} className="text-blue-600 dark:text-blue-400" /> 规则基准流水
            </h3>
            
            <div className="flex items-center gap-4 p-2 bg-slate-100 dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-3 px-5 py-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10">
                <Search size={16} className="text-slate-400" />
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="检索规则..." 
                  className="bg-transparent border-none text-xs dark:text-white text-slate-900 focus:outline-none w-24 sm:w-32 placeholder:text-slate-400 font-bold" 
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'fail', 'warn'] as const).map(f => (
                  <button 
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setSearchTerm('');
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${
                      filter === f 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {f === 'all' ? '全部' : f === 'fail' ? '错误' : '警告'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {filteredChecks.length > 0 ? (
              filteredChecks.map((check, index) => (
                <AuditItem key={`${check.id}-${index}`} item={check} />
              ))
            ) : (
              <div className="p-20 text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-widest">未找到匹配项</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：操作面板 */}
      <div className="lg:col-span-4 space-y-10 sticky top-28">
        <div className={`${CARD_STYLE} p-10 rounded-[3.5rem] space-y-6`}>
          <div className="pb-6 border-b border-slate-100 dark:border-white/5">
            <h3 className="text-lg font-black dark:text-white text-slate-900 tracking-tight mb-2 uppercase">报告分发控制</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">审核通过后可正式签署导出</p>
          </div>
          
          <div className="space-y-4">
            <button
              className="w-full flex items-center justify-between px-8 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black transition-all shadow-xl shadow-blue-600/30 group active:scale-95"
              onClick={handleExportPdf}
            >
              <span className="flex items-center gap-3"><Download size={22} /> 导出完整报告</span>
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              className="w-full flex items-center justify-between px-8 py-6 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-3xl font-black transition-all group active:scale-95"
              onClick={() => setShowEvidenceModal(true)}
            >
              <span className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] tracking-[0.18em]">
                  TXT
                </span>
                警告与错误项精简视图
              </span>
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

        </div>
      </div>

      {showEvidenceModal && (
        <EvidenceShareModal
          report={report}
          checks={evidenceChecks}
          onClose={() => setShowEvidenceModal(false)}
        />
      )}
    </div>
  );
};

export default ComplianceReport;
