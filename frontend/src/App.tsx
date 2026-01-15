/**
 * App.tsx - 智能固件合规审计系统主应用
 *
 * 功能描述:
 *   - 固件包上传与解析
 *   - AI 驱动的合规性分析
 *   - 审计报告生成与展示
 *
 * 工作流程:
 *   upload(上传) -> analyzing(分析中) -> report(报告)
 *
 * 依赖组件:
 *   - UploadZone: 文件上传区域
 *   - ComplianceReport: 合规报告展示
 *
 * @module App
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  History,
  Moon,
  Sun,
  Bot,
  Terminal,
  BrainCircuit,
  Activity,
  Zap,
  ChevronLeft,
  Loader2
} from 'lucide-react';

// 导入子组件
import UploadZone from './components/UploadZone';
import ComplianceReport from './components/ComplianceReport';

// 导入类型定义和常量
import { InspectionReport, FirmwareType, CheckStatus, CheckItem } from './types';
import { createAudit, ApiFirmwareType, getAudit, getAuditLogs, getAuditReport, ConsoleLog as ApiConsoleLog, AuditReportDto, AuditTask, listAudits } from './api/client';
import { MOCK_REPORT_META } from './constants';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 应用工作流程阶段
 */
type AppPhase = 'upload' | 'analyzing' | 'report';

/**
 * 控制台日志条目结构
 */
interface ConsoleLog {
  /** 日志内容 */
  message: string;
  /** 日志时间戳 */
  timestamp: Date;
  /** 日志级别 */
  level: 'info' | 'warn' | 'success' | 'error' | 'debug';
}

/**
 * AI 引擎配置参数
 */
interface AnalysisConfig {
  /** 单条日志间隔时间 (毫秒) */
  logInterval: number;
  /** 模拟分析总耗时 (毫秒) */
  totalDuration: number;
}

// ============================================================================
// 常量配置 - 可配置化
// ============================================================================

/**
 * 分析引擎配置
 */
const ANALYSIS_CONFIG: AnalysisConfig = {
  logInterval: 500,      // 每 500ms 输出一条日志
  totalDuration: 6000,   // 总共需要 6 秒完成分析
};

/**
 * 主题配置
 */
const THEME_CONFIG = {
  storageKey: 'core-audit-theme',  // localStorage 中的键名
};

// ============================================================================
// 子组件定义
// ============================================================================

/**
 * 导航栏组件 (NavBar)
 *
 * 功能:
 *   - 显示应用品牌和状态
 *   - 提供主题切换功能
 *   - 提供搜索和历史记录入口
 *
 * 性能优化:
 *   - 使用 React.memo 避免不必要重渲染
 *
 * @param props - 组件属性
 * @param props.darkMode - 当前是否为深色模式
 * @param props.toggleTheme - 主题切换回调
 * @param props.onReset - 重置应用状态回调
 */
const NavBar: React.FC<{
  darkMode: boolean;
  toggleTheme: () => void;
  onReset: () => void;
  onToggleHistory: () => void;
}> = React.memo(({ darkMode, toggleTheme, onReset, onToggleHistory }) => (
  <nav className="w-full max-w-7xl px-8 h-20 flex items-center justify-between z-40 sticky top-0 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-white/5 transition-colors">
    {/* 品牌区域 - 点击可重置应用 */}
    <div
      className="flex items-center gap-4 cursor-pointer group"
      onClick={onReset}
      title="点击返回首页"
    >
      {/* Logo 图标 */}
      <div className="bg-blue-600 p-2.5 rounded-2xl shadow-xl shadow-blue-600/30 group-hover:rotate-[15deg] transition-all">
        <ShieldCheck className="text-white" size={26} />
      </div>

      {/* 标题和状态指示器 */}
      <div>
        <h1 className="font-black text-2xl tracking-tighter dark:text-white text-slate-900 uppercase leading-none">
          Core <span className="text-blue-600 dark:text-blue-400">Audit</span>
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
            AI 审计引擎在线
          </p>
        </div>
      </div>
    </div>

    {/* 右侧工具栏 */}
    <div className="flex items-center gap-3">
      {/* 主题切换按钮 */}
      <button
        onClick={toggleTheme}
        className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl hover:scale-105 transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
        aria-label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"></div>

      {/* 审计历史按钮 - 中等屏幕以上显示 */}
      <button
        className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all"
        onClick={onToggleHistory}
      >
        <History size={18} /> 审计历史
      </button>
    </div>
  </nav>
));

// 导出 displayName 以便 React DevTools 正确显示
NavBar.displayName = 'NavBar';

/**
 * 页脚组件 (Footer)
 *
 * 功能:
 *   - 显示系统状态和版本信息
 *   - 提供合规相关链接
 *
 * @module Footer
 */
const Footer: React.FC = React.memo(() => (
  <footer className="w-full max-w-7xl px-8 py-12 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center text-slate-400 text-[11px] gap-8 mt-auto font-black uppercase tracking-[0.25em]">
    {/* 左侧: 系统状态和版本 */}
    <div className="flex items-center gap-4">
      <div className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-500 rounded-lg border border-green-500/20">
        System Online
      </div>
      字节固件合规审计平台 v1.0.0
    </div>

    {/* 右侧: 链接和版权 */}
    <div className="flex items-center gap-10">
      <p className="text-emerald-300 dark:text-emerald-300 opacity-70">光圈@libiao1</p>
      <p className="text-slate-200 dark:text-slate-500 normal-case tracking-normal">
        注意：认知分析是本产品的设计目标
      </p>
    </div>
  </footer>
));

Footer.displayName = 'Footer';

// ============================================================================
// 主应用组件
// ============================================================================
/**
 * App - 智能固件合规审计系统主组件
 *
 * 功能描述:
 *   - 管理应用的整体状态和工作流程
 *   - 协调各子组件的渲染
 *   - 处理用户交互和业务逻辑
 *
 * 状态管理:
 *   - phase: 当前工作流程阶段
 *   - currentReport: 当前审计报告
 *   - darkMode: 深色模式开关
 *   - analysisLogs: 分析过程中的日志序列
 *
 * 性能优化:
 *   - 使用 useCallback 缓存回调函数
 *   - 使用 useRef 追踪日志容器底部
 *
 * @returns 应用根组件 JSX
 */
const App: React.FC = () => {
  // --------------------------------------------------------------------------
  // 状态定义
  // --------------------------------------------------------------------------

  /** 当前工作流程阶段: 上传 -> 分析中 -> 报告 */
  const [phase, setPhase] = useState<AppPhase>('upload');

  /** 当前审计报告数据，报告阶段时不为空 */
  const [currentReport, setCurrentReport] = useState<InspectionReport | null>(null);

  /** 深色模式状态，从 localStorage 恢复或默认为 false */
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_CONFIG.storageKey);
    return saved ? saved === 'dark' : false;
  });

  /** 分析过程中的日志序列 */
  const [analysisLogs, setAnalysisLogs] = useState<ConsoleLog[]>([]);
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);

  /** 日志容器底部引用，用于自动滚动 */
  const logEndRef = useRef<HTMLDivElement>(null);

  /** 分析阶段相关的定时器引用，便于在重置或卸载时统一清理 */
  const analysisTimeoutsRef = useRef<number[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);

  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditTask[]>([]);

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  /**
   * 深色模式同步 Effect
   *
   * 功能:
   *   - 将 darkMode 状态同步到 HTML 根元素的 class
   *   - 同时保存到 localStorage 持久化
   */
  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.classList.toggle('light', !darkMode);
    localStorage.setItem(THEME_CONFIG.storageKey, theme);
  }, [darkMode]);

  /**
   * 自动滚动到底部 Effect
   *
   * 功能:
   *   - 当日志更新时，自动滚动到最新日志
   *   - 仅在分析阶段生效
   */
  useEffect(() => {
    if (phase === 'analyzing') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [analysisLogs, phase]);

  /**
   * 组件卸载或重置时清理分析阶段的所有定时器
   *
   * 说明:
   *   - 防止组件卸载后仍然尝试更新状态
   *   - 为未来接入真实 API 时提供统一的清理入口
   */
  const clearAnalysisTimers = useCallback(() => {
    analysisTimeoutsRef.current.forEach(timeoutId => {
      window.clearTimeout(timeoutId);
    });
    analysisTimeoutsRef.current = [];
  }, []);

  const mapApiLogs = (logs: ApiConsoleLog[]): ConsoleLog[] => {
    return logs.map(log => ({
      message: log.message,
      timestamp: new Date(log.timestamp),
      level: (log.level as any) || 'info',
    }));
  };

  useEffect(() => {
    if (!currentAuditId || phase !== 'analyzing') return;

    const lastLogTimestampRef = { current: null as string | null };

    const intervalId = window.setInterval(async () => {
      try {
        let audit: AuditTask | null = null;
        try {
          audit = await getAudit(currentAuditId);
        } catch (err) {
          console.error('[audit] getAudit failed', err);
        }

        try {
          const logs = await getAuditLogs(currentAuditId, lastLogTimestampRef.current || undefined);
          if (logs.length > 0) {
            const newLogs = mapApiLogs(logs);
            setAnalysisLogs(prev => [...prev, ...newLogs]);
            const lastRaw = logs[logs.length - 1];
            lastLogTimestampRef.current = lastRaw.timestamp;
          }
        } catch (err) {
          console.error('[audit] getAuditLogs failed', err);
        }

        if (audit && (audit.status === 'COMPLETED' || audit.status === 'FAILED')) {
          try {
            const report = await getAuditReport(currentAuditId);
            const mappedReport = mapApiReport(report);
            setCurrentReport(mappedReport);
          } catch (err) {
            console.error('Failed to fetch audit report', err);
          }
          setPhase('report');
          window.clearInterval(intervalId);
        }
      } catch (e) {
        console.error(e);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentAuditId, phase]);

  const mapApiReport = (dto: AuditReportDto): InspectionReport => {
    const checks: CheckItem[] = dto.checks.map(c => ({
      id: c.id,
      category: c.category,
      name: c.name,
      status:
        c.status === 'PASS'
          ? CheckStatus.PASS
          : c.status === 'WARNING'
          ? CheckStatus.WARNING
          : CheckStatus.FAIL,
      description: c.description,
      standard: c.standard,
    }));

    const summary = dto.summary || { total: 0, passed: 0, warning: 0, failed: 0 };
    const overallScore = summary.total > 0 ? Math.max(0, Math.round(((summary.passed + summary.warning * 0.5) / summary.total) * 100)) : 0;

    return {
      id: dto.id,
      timestamp: dto.timestamp,
      firmwareType: dto.firmwareType === 'BMC' ? FirmwareType.BMC : dto.firmwareType === 'BIOS' ? FirmwareType.BIOS : FirmwareType.UNKNOWN,
      productName: dto.productName,
      version: dto.version,
      overallScore,
      checks,
      fileStructure: [],
      trend: { fix: 0, new: 0 },
    };
  };

  useEffect(() => {
    return () => {
      clearAnalysisTimers();
    };
  }, [clearAnalysisTimers]);

  // --------------------------------------------------------------------------
  // 回调函数
  // --------------------------------------------------------------------------

  const loadAuditHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await listAudits({ limit: 20, offset: 0 });
      setAuditHistory(res.items || []);
    } catch (e) {
      setHistoryError('加载审计历史失败');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /**
   * 开始分析处理函数
   *
   * 功能:
   *   - 接收用户上传的文件
   *   - 接收用户选择的固件类型
   *   - 切换到分析阶段
   *   - 模拟 AI 引擎的分析过程
   *   - 生成并显示分析日志
   *   - 分析完成后生成报告
   *
   * 业务逻辑说明:
   *   - 使用 setTimeout 模拟异步分析过程
   *   - 实际项目中应替换为真实的 API 调用
   *
   * @param files - 用户上传的文件数组
   * @param firmwareType - 用户选择的固件类型 (AMI | OpenBMC)
   * @param checkScript - 用户选择的检查脚本文件名
   */
  const handleStartAnalysis = useCallback(
    async (files: File[], firmwareType: 'AMI' | 'OpenBMC', checkScript: string) => {
      if (!files.length) return;

      setIsProcessing(true);

      try {
        const mappedFirmwareType: ApiFirmwareType =
          firmwareType === 'OpenBMC' ? 'BMC' : 'BIOS';

        const audit = await createAudit({
          file: files[0],
          firmwareType: mappedFirmwareType,
          bmcType: firmwareType,
          checkScript,
          productName: MOCK_REPORT_META.productName,
          version: MOCK_REPORT_META.version,
        });
        setCurrentAuditId(audit.id);
        clearAnalysisTimers();
        setAnalysisLogs([]);
        setPhase('analyzing');
      } catch (error) {
        console.error(error);
        clearAnalysisTimers();
        setPhase('upload');
        setCurrentReport(null);
        setAnalysisLogs([]);
      } finally {
        setIsProcessing(false);
      }
    },
    [clearAnalysisTimers]
  );

  const handleToggleHistory = useCallback(() => {
    if (!showHistoryPanel && auditHistory.length === 0) {
      loadAuditHistory();
    }
    setShowHistoryPanel(prev => !prev);
  }, [showHistoryPanel, auditHistory.length, loadAuditHistory]);

  const handleSelectAuditFromHistory = useCallback(
    async (task: AuditTask) => {
      setShowHistoryPanel(false);
      setCurrentAuditId(task.id);
      clearAnalysisTimers();
      setAnalysisLogs([]);

      if (task.status === 'COMPLETED' || task.status === 'FAILED') {
        try {
          const report = await getAuditReport(task.id);
          const mappedReport = mapApiReport(report);
          setCurrentReport(mappedReport);
          setPhase('report');
        } catch (err) {
          console.error('Failed to load audit report from history', err);
        }
      } else {
        setPhase('analyzing');
      }
    },
    [clearAnalysisTimers, mapApiReport]
  );

  /**
   * 重置应用状态
   *
   * 功能:
   *   - 返回上传阶段
   *   - 清空当前报告
   *   - 清空分析日志
   */
  const resetApp = useCallback(() => {
    // 重置时清理掉所有分析阶段的定时器与日志
    clearAnalysisTimers();
    setPhase('upload');
    setCurrentReport(null);
    setAnalysisLogs([]);
    setCurrentAuditId(null);
  }, [clearAnalysisTimers]);

  /**
   * 主题切换回调
   *
   * 描述:
   *   - 切换深色/亮色模式
   *   - 使用函数式更新确保状态正确
   */
  const toggleTheme = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  /**
   * 获取日志显示文本
   *
   * 功能:
   *   - 根据日志级别返回对应的 CSS 类名
   *
   * @param log - 日志对象
   * @returns 对应的 CSS 类名字符串
   */
  const getLogClassName = (log: ConsoleLog): string => {
    if (log.level === 'warn') return 'text-amber-400';
    if (log.level === 'success') return 'text-green-400 font-bold';
    if (log.level === 'debug') return 'text-blue-400';
    return '';
  };

  const getStatusLabel = (status: AuditTask['status']) => {
    if (status === 'PENDING') return '排队中';
    if (status === 'UPLOADING') return '上传中';
    if (status === 'ANALYZING') return '分析中';
    if (status === 'COMPLETED') return '已完成';
    if (status === 'FAILED') return '失败';
    return status;
  };

  const getStatusClassName = (status: AuditTask['status']) => {
    if (status === 'COMPLETED') {
      return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
    }
    if (status === 'FAILED') {
      return 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30';
    }
    if (status === 'ANALYZING' || status === 'UPLOADING') {
      return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30';
    }
    return 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-600/60';
  };

  // --------------------------------------------------------------------------
  // 渲染逻辑
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col items-center transition-all duration-700 ease-in-out">
      {/* 顶部导航栏 */}
      <NavBar
        darkMode={darkMode}
        toggleTheme={toggleTheme}
        onReset={resetApp}
        onToggleHistory={handleToggleHistory}
      />

      {/* 主内容区域 */}
      <main className="w-full max-w-7xl px-8 py-10 flex-1 flex flex-col relative z-20">
        {/* 上传阶段 */}
        {phase === 'upload' && (
          <UploadPhase onFilesAccepted={handleStartAnalysis} isProcessing={isProcessing} />
        )}

        {/* 分析阶段 */}
        {phase === 'analyzing' && (
          <AnalyzingPhase
            logs={analysisLogs}
            logEndRef={logEndRef}
            getLogClassName={getLogClassName}
          />
        )}

        {/* 报告阶段 */}
        {phase === 'report' && currentReport && (
          <ReportPhase
            report={currentReport}
            onReset={resetApp}
          />
        )}
      </main>

      {showHistoryPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowHistoryPanel(false)}
          />
          <div className="relative h-full w-full max-w-md bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-slate-700 dark:text-slate-100" />
                <span className="text-sm font-bold tracking-widest text-slate-700 dark:text-slate-100">
                  审计历史
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadAuditHistory}
                  disabled={historyLoading}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/20 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  刷新
                </button>
                <button
                  onClick={() => setShowHistoryPanel(false)}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/20 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyError && (
                <div className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/30 rounded-2xl px-4 py-3">
                  {historyError}
                </div>
              )}
              {historyLoading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin text-blue-500" size={20} />
                </div>
              )}
              {!historyLoading && !historyError && auditHistory.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-10">
                  暂无历史记录
                </div>
              )}
              {!historyLoading &&
                !historyError &&
                auditHistory.map((task: AuditTask) => {
                  const createdAt = task.createdAt ? new Date(task.createdAt) : null;
                  const completedAt = task.completedAt ? new Date(task.completedAt) : null;
                  const summary = task.summary;
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleSelectAuditFromHistory(task)}
                      className="w-full text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 hover:border-blue-500/40 hover:bg-white dark:hover:bg-slate-800/80 transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-100">
                            {task.productName || '未命名固件'}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {task.version || '未知版本'}
                          </span>
                        </div>
                        <span
                          className={
                            'text-[10px] font-bold px-3 py-1 rounded-full border ' +
                            getStatusClassName(task.status)
                          }
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400">
                            创建时间:{' '}
                            {createdAt ? createdAt.toLocaleString() : '未知'}
                          </span>
                          {completedAt && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              完成时间: {completedAt.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {summary && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-300">
                            <span>合规 {summary.passed}</span>
                            <span>警告 {summary.warning}</span>
                            <span>错误 {summary.failed}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 底部页脚 */}
      <Footer />
    </div>
  );
};

// ============================================================================
// 子阶段组件 - 分离渲染逻辑以提高可维护性
// ============================================================================

/**
 * 上传阶段组件
 *
 * 描述:
 *   - 显示应用介绍信息
 *   - 提供文件上传区域
 */
const UploadPhase: React.FC<{
  onFilesAccepted: (files: File[], firmwareType: 'AMI' | 'OpenBMC', checkScript: string) => void;
  isProcessing: boolean;
}> = ({ onFilesAccepted, isProcessing }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 items-center flex-1">
      {/* 左侧: 介绍信息 */}
      <div className="xl:col-span-5 space-y-12 animate-in fade-in slide-in-from-left-12 duration-1000">
        {/* 标题区域 */}
        <div className="space-y-6">
          {/* 合规标签 */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 dark:border-blue-500/20">
            <Activity size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              符合字节大客户标准规范
            </span>
          </div>

          {/* 主标题 */}
          <h2 className="text-6xl font-black dark:text-white text-slate-900 leading-[1.05] tracking-tight">
            字节发版固件包
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
              智能自动化
            </span>
            <br />
            合规自查
          </h2>


        </div>

        {/* 功能特性列表 */}
        <div className="grid grid-cols-1 gap-5">
          {[
            { icon: BrainCircuit, title: '认知分析', desc: '基于 AI 大模型 的非结构化测试报告深度理解' },
            { icon: Terminal, title: '结构一致性', desc: '多层级目录与命名规范自动对齐校验' },
          ].map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-6 p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all group shadow-sm"
            >
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                <item.icon size={26} />
              </div>
              <div>
                <h4 className="font-black dark:text-white text-slate-900 text-lg tracking-tight">
                  {item.title}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 font-medium leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧: 上传区域 */}
      <div className="xl:col-span-7 animate-in fade-in slide-in-from-right-12 duration-1000">
        <UploadZone onFilesAccepted={onFilesAccepted} isProcessing={isProcessing} />
      </div>
    </div>
  );
};

/**
 * 分析阶段组件
 *
 * 描述:
 *   - 显示 AI 引擎工作动画
 *   - 实时展示分析日志
 *
 * @param props - 组件属性
 * @param props.logs - 日志数组
 * @param props.logEndRef - 日志容器底部引用
 * @param props.getLogClassName - 获取日志样式回调
 */
const AnalyzingPhase: React.FC<{
  logs: ConsoleLog[];
  logEndRef: React.RefObject<HTMLDivElement>;
  getLogClassName: (log: ConsoleLog) => string;
}> = ({ logs, logEndRef, getLogClassName }) => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 animate-in fade-in scale-95 duration-1000">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
        {/* 左侧: AI 引擎动画 */}
        <div className="flex flex-col items-center space-y-12 text-center">
          {/* 旋转动画效果 */}
          <div className="relative">
            <div className="absolute inset-0 bg-blue-600/20 dark:bg-blue-500/10 blur-[100px] rounded-full"></div>
            <div className="relative w-72 h-72 flex items-center justify-center">
              {/* 外圈 - 灰色 */}
              <div className="absolute inset-0 border-8 border-slate-100 dark:border-white/5 rounded-full"></div>
              {/* 内圈 - 蓝色旋转 */}
              <div className="absolute inset-0 border-t-8 border-blue-600 dark:border-blue-400 rounded-full animate-spin-slow"></div>
              {/* 中心机器人图标 */}
              <div className="relative z-10 p-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-white/10">
                <Bot size={80} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* 状态文字 */}
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              AI 引擎深度审计中
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
              正在执行 Cross-Document 逻辑闭环校验...
            </p>
          </div>
        </div>

        {/* 右侧: 控制台日志 */}
        <div className="bg-slate-900 rounded-[3rem] p-10 h-[500px] flex flex-col border border-white/10 shadow-2xl relative overflow-hidden">
          {/* 控制台标题栏 */}
          <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <span className="text-[10px] font-mono text-slate-500 ml-4 font-bold uppercase tracking-widest">
              Auditor Console v1.0
            </span>
          </div>

          {/* 日志输出区域 */}
          <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-3 custom-scrollbar text-green-400/80 leading-relaxed">
            {logs.map((log, index) => (
              <div
                key={index}
                className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300"
              >
                <span className="text-slate-600 shrink-0">
                  [{log.timestamp.toLocaleTimeString()}]
                </span>
                <span className={getLogClassName(log)}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* 加载状态指示器 */}
          <div className="absolute bottom-10 right-10 flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
            <Loader2 className="animate-spin text-blue-400" size={16} />
            <span className="text-white text-[10px] font-black uppercase tracking-widest">
              正在解析...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 报告阶段组件
 *
 * 描述:
 *   - 显示返回按钮和报告元信息
   *- 渲染完整的审计报告
 *
 * @param props - 组件属性
 * @param props.report - 审计报告数据
 * @param props.onReset - 重置回调
 */
const ReportPhase: React.FC<{
  report: InspectionReport;
  onReset: () => void;
}> = ({ report, onReset }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
      {/* 顶部工具栏 */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        {/* 返回按钮 */}
        <button
          onClick={onReset}
          className="flex items-center gap-4 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-all text-sm font-black group px-8 py-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm active:scale-95"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          返回并重试审计
        </button>

        {/* 报告状态指示 */}
        <div className="flex items-center gap-5 px-8 py-4 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
            最终审计报告 • {report.timestamp}
          </span>
        </div>
      </div>

      {/* 报告内容 */}
      <ComplianceReport report={report} />
    </div>
  );
};

// ============================================================================
// 导出
// ============================================================================

export default App;
