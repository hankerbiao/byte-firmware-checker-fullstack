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
import { ShieldCheck, History, Loader2, Zap } from 'lucide-react';

import { NavBar, Footer, UploadPhase, AnalyzingPhase, ReportPhase } from './AppLayoutParts';

// 导入类型定义和常量
import { InspectionReport, FirmwareType, CheckStatus, CheckItem, ConsoleLog } from './types';
import { createAuditChunked, ApiFirmwareType, getAudit, getAuditLogs, getAuditReport, ConsoleLog as ApiConsoleLog, AuditReportDto, AuditTask, listAudits, getHealth, submitOALogin, setSessionToken, restoreSessionTokenFromStorage, getCurrentUser } from './api/client';
import { MOCK_REPORT_META } from './constants';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 应用工作流程阶段
 */
type AppPhase = 'upload' | 'analyzing' | 'report';

/**
 * 主题配置
 */
const THEME_CONFIG = {
  storageKey: 'core-audit-theme',  // localStorage 中的键名
};

const OA_APP_NAME = 'bytespkgcheck';
const OA_LOGIN_BASE_URL = 'http://tl.cooacloud.com/springboard_v3/login_proxy';

const mapApiLogs = (logs: ApiConsoleLog[]): ConsoleLog[] => {
  return logs.map(log => ({
    message: log.message,
    timestamp: new Date(log.timestamp),
    level: (log.level as any) || 'info',
  }));
};

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
  const overallScore =
    summary.total > 0
      ? Math.max(
          0,
          Math.round(
            ((summary.passed + summary.warning * 0.5) / summary.total) * 100
          )
        )
      : 0;

  return {
    id: dto.id,
    timestamp: dto.timestamp,
    firmwareType:
      dto.firmwareType === 'BMC'
        ? FirmwareType.BMC
        : dto.firmwareType === 'BIOS'
        ? FirmwareType.BIOS
        : FirmwareType.UNKNOWN,
    productName: dto.productName,
    version: dto.version,
    overallScore,
    checks,
    fileStructure: [],
    trend: { fix: 0, new: 0 },
  };
};

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
  if (status === 'COMPLETED') return '通过';
  if (status === 'FAILED') return '不通过';
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

const getNavUserName = (oaUser: unknown): string | null => {
  if (!oaUser) return null;
  const anyUser = oaUser as any;
  return anyUser.姓名 || anyUser.name || anyUser.displayName || anyUser.itcode || null;
};

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
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [oaUser, setOaUser] = useState<unknown | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }, []);

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
    restoreSessionTokenFromStorage();
    getCurrentUser()
      .then(current => {
        setOaUser(current.user ?? null);
      })
      .catch(err => {
        if ((err as Error).message === 'UNAUTHORIZED') {
          setOaUser(null);
        } else {
          console.error('Failed to restore OA user', err);
        }
      });
  }, []);

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.classList.toggle('light', !darkMode);
    localStorage.setItem(THEME_CONFIG.storageKey, theme);
  }, [darkMode]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const payload = url.searchParams.get('payload');
    const next = url.searchParams.get('next');

    if (!status || !payload) {
      return;
    }

    submitOALogin({
      status,
      payload,
      next,
    })
      .then(async result => {
        if (result.token) {
          setSessionToken(result.token);
        }

        try {
          const current = await getCurrentUser();
          setOaUser(current.user ?? null);
          const anyUser = (current.user || {}) as any;
          const name = anyUser.姓名;
          if (name) {
            showNotification(`登录成功，欢迎回来 ${name}`);
          } else {
            showNotification('登录成功，欢迎回来');
          }
        } catch (err) {
          console.error('Failed to fetch OA user after login', err);
          setOaUser(null);
          showNotification('登录成功，但获取用户信息失败', 'error');
        }

        url.searchParams.delete('status');
        url.searchParams.delete('payload');
        url.searchParams.delete('next');
        window.history.replaceState(null, '', url.toString());
      })
      .catch(error => {
        console.error('OA 登录失败', error);
        showNotification('OA 登录失败，请重试', 'error');
      });
  }, [showNotification]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await getHealth();
        if (!cancelled) {
          setHealthy(res.status === 'ok');
        }
      } catch {
        if (!cancelled) {
          setHealthy(false);
        }
      }
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

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

  const handleOALogin = useCallback(() => {
    const next = window.location.origin;
    const target = `${OA_LOGIN_BASE_URL}/${encodeURIComponent(OA_APP_NAME)}?next=${encodeURIComponent(next)}`;
    window.location.href = target;
  }, []);

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
    } catch (e: any) {
      if (e && e.message === 'UNAUTHORIZED') {
        setHistoryError('加载审计历史失败：未登录，请先通过 OA 登录');
      } else {
        setHistoryError('加载审计历史失败');
      }
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
    async (
      files: File[],
      firmwareType: 'AMI' | 'OpenBMC',
      checkScript: string,
      onProgress: (uploadedBytes: number, totalBytes: number) => void,
    ) => {
      if (!files.length) return;

      setIsProcessing(true);

      try {
        const mappedFirmwareType: ApiFirmwareType =
          firmwareType === 'OpenBMC' ? 'BMC' : 'BIOS';

        const audit = await createAuditChunked(
          {
            file: files[0],
            firmwareType: mappedFirmwareType,
            bmcType: firmwareType,
            checkScript,
            productName: MOCK_REPORT_META.productName,
            version: MOCK_REPORT_META.version,
          },
          {
            onProgress,
          },
        );
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

  const navUserName = getNavUserName(oaUser);

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
        healthy={healthy}
        onLogin={handleOALogin}
        onLogout={() => {
          setSessionToken(null);
          setOaUser(null);
          resetApp();
          showNotification('已退出登录');
        }}
        loggedIn={oaUser != null}
        userName={navUserName}
      />

      {/* 全局通知 */}
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-5 duration-300">
          <div
            className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-md ${
              notification.type === 'success'
                ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-900/90 dark:text-emerald-100 dark:border-emerald-700'
                : 'bg-rose-50/90 text-rose-700 border-rose-200 dark:bg-rose-900/90 dark:text-rose-100 dark:border-rose-700'
            }`}
          >
            {notification.type === 'success' ? <ShieldCheck size={18} /> : <Zap size={18} />}
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <main className="w-full max-w-7xl px-8 py-10 flex-1 flex flex-col relative z-20">
        {/* 上传阶段 */}
        {phase === 'upload' && (
          <UploadPhase
            onFilesAccepted={handleStartAnalysis}
            isProcessing={isProcessing || healthy === false}
            loggedIn={oaUser != null}
          />
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
      <Footer healthy={healthy} />
    </div>
  );
};

// ============================================================================
// 导出
// ============================================================================

export default App;
