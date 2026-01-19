import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    ShieldCheck,
    History,
    Moon,
    Sun,
    LogIn,
    User,
    Activity,
    BrainCircuit,
    Terminal,
    Bot,
    Loader2,
    ChevronLeft,
} from 'lucide-react';

import UploadZone from './components/UploadZone';
import ComplianceReport from './components/ComplianceReport';
import {ConsoleLog, InspectionReport} from './types';

export const NavBar: React.FC<{
    darkMode: boolean;
    toggleTheme: () => void;
    onReset: () => void;
    onToggleHistory: () => void;
    healthy: boolean | null;
    onLogin: () => void;
    onLogout: () => void;
    loggedIn: boolean;
    userName?: string | null;
}> = React.memo(
    ({darkMode, toggleTheme, onReset, onToggleHistory, healthy, onLogin, onLogout, loggedIn, userName}) => {
        const [userMenuOpen, setUserMenuOpen] = useState(false);
        const userMenuRef = useRef<HTMLDivElement | null>(null);

        useEffect(() => {
            if (!userMenuOpen) return;
            const handleClickOutside = (event: MouseEvent) => {
                if (!userMenuRef.current) return;
                if (!userMenuRef.current.contains(event.target as Node)) {
                    setUserMenuOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, [userMenuOpen]);

        return (
            <nav
                className="w-full max-w-7xl px-8 h-20 flex items-center justify-between z-40 sticky top-0 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-white/5 transition-colors">
                <div
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={onReset}
                    title="点击返回首页"
                >
                    <div
                        className="bg-blue-600 p-2.5 rounded-2xl shadow-xl shadow-blue-600/30 group-hover:rotate-[15deg] transition-all">
                        <ShieldCheck className="text-white" size={26}/>
                    </div>

                    <div>
                        <h1 className="font-black text-2xl tracking-tighter dark:text-white text-slate-900 uppercase leading-none">
                            Core <span className="text-blue-600 dark:text-blue-400">Audit</span>
                        </h1>
                        <div className="flex items-center gap-1.5 mt-1">
              <span
                  className={
                      'w-1.5 h-1.5 rounded-full animate-pulse ' +
                      (healthy === false
                          ? 'bg-rose-500'
                          : healthy === true
                              ? 'bg-green-500'
                              : 'bg-slate-400')
                  }
              />
                            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
                                {healthy === null
                                    ? 'AI 审计引擎检查中'
                                    : healthy
                                        ? 'AI 审计引擎在线'
                                        : 'AI 审计引擎异常'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl hover:scale-105 transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                        aria-label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
                    >
                        {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                    </button>

                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"/>

                    <button
                        className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all"
                        onClick={onToggleHistory}
                    >
                        <History size={18}/> 审计历史
                    </button>

                    {!loggedIn && (
                        <button
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-all"
                            onClick={onLogin}
                        >
                            <LogIn size={16}/>
                            <span>OA 登录</span>
                        </button>
                    )}
                    {loggedIn && (
                        <div className="relative" ref={userMenuRef}>
                            <button
                                type="button"
                                onClick={() => setUserMenuOpen(open => !open)}
                                className="flex items-center gap-2 pl-1 pr-4 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all"
                            >
                                <div
                                    className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-inner">
                                    <User size={14}/>
                                </div>
                                <span>你好{userName ? ` ${userName}` : ''}</span>
                            </button>
                            {userMenuOpen && (
                                <div
                                    className="absolute right-0 mt-2 w-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-lg py-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserMenuOpen(false);
                                            onLogout();
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                                    >
                                        退出登录
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </nav>
        );
    },
);

NavBar.displayName = 'NavBar';

export const Footer: React.FC<{ healthy: boolean | null }> = React.memo(({healthy}) => (
    <footer
        className="w-full max-w-7xl px-8 py-12 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center text-slate-400 text-[11px] gap-8 mt-auto font-black uppercase tracking-[0.25em]">
        <div className="flex items-center gap-4">
            <div
                className={
                    healthy === false
                        ? 'px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/30'
                        : healthy === true
                            ? 'px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-500 rounded-lg border border-green-500/20'
                            : 'px-3 py-1 bg-slate-200/40 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-300/40'
                }
            >
                {healthy === null ? 'Checking...' : healthy ? 'System Online' : 'System Error'}
            </div>
            字节固件合规审计平台 v1.0.0
        </div>

        <div className="flex items-center gap-10">
            <p className="text-emerald-300 dark:text-emerald-300 opacity-70">光圈@libiao1</p>
            <p className="text-slate-300 dark:text-slate-500 normal-case tracking-normal">
                注意：认知分析是本产品的设计目标
            </p>
        </div>
    </footer>
));

Footer.displayName = 'Footer';

export const UploadPhase: React.FC<{
    onFilesAccepted: (
        files: File[],
        firmwareType: 'AMI' | 'OpenBMC',
        checkScript: string,
        onProgress: (uploadedBytes: number, totalBytes: number) => void,
    ) => void;
    isProcessing: boolean;
    loggedIn: boolean;
}> = ({onFilesAccepted, isProcessing, loggedIn}) => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 items-center flex-1">
            <div className="xl:col-span-5 space-y-12 animate-in fade-in slide-in-from-left-12 duration-1000">
                <div className="space-y-6">
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 dark:border-blue-500/20">
                        <Activity size={16} className="text-blue-600 dark:text-blue-400"/>
                        <span
                            className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              符合字节大客户标准规范
            </span>
                    </div>

                    <h2 className="text-6xl font-black dark:text-white text-slate-900 leading-[1.05] tracking-tight">
                        字节发版固件包
                        <br/>
                        <span
                            className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
              智能自动化
            </span>
                        <br/>
                        合规自查
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-5">
                    {[
                        {icon: BrainCircuit, title: '认知分析', desc: '基于 AI 大模型 的非结构化测试报告深度理解'},
                        {icon: Terminal, title: '结构一致性', desc: '多层级目录与命名规范自动对齐校验'},
                    ].map((item, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-6 p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all group shadow-sm"
                        >
                            <div
                                className="p-4 bg-white dark:bg-slate-800 rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                                <item.icon size={26}/>
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

            <div className="xl:col-span-7 animate-in fade-in slide-in-from-right-12 duration-1000">
                <UploadZone onFilesAccepted={onFilesAccepted} isProcessing={isProcessing} isLoggedIn={loggedIn}/>
            </div>
        </div>
    );
};

export const AnalyzingPhase: React.FC<{
    logs: ConsoleLog[];
    logEndRef: React.RefObject<HTMLDivElement>;
    getLogClassName: (log: ConsoleLog) => string;
}> = ({logs, logEndRef, getLogClassName}) => {
    return (
        <div
            className="flex flex-col items-center justify-center flex-1 py-12 animate-in fade-in scale-95 duration-1000">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
                <div className="flex flex-col items-center space-y-12 text-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-600/20 dark:bg-blue-500/10 blur-[100px] rounded-full"/>
                        <div className="relative w-72 h-72 flex items-center justify-center">
                            <div
                                className="absolute inset-0 border-8 border-slate-100 dark:border-white/5 rounded-full"/>
                            <div
                                className="absolute inset-0 border-t-8 border-blue-600 dark:border-blue-400 rounded-full animate-spin-slow"/>
                            <div
                                className="relative z-10 p-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-white/10">
                                <Bot size={80} className="text-blue-600 dark:text-blue-400"/>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            AI 引擎深度审计中
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
                            正在执行 Cross-Document 逻辑闭环校验...
                        </p>
                    </div>
                </div>

                <div
                    className="bg-slate-900 rounded-[3rem] p-10 h-[500px] flex flex-col border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500"/>
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"/>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500"/>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 ml-4 font-bold uppercase tracking-widest">
              Auditor Console v1.0
            </span>
                    </div>

                    <div
                        className="flex-1 overflow-y-auto font-mono text-[11px] space-y-3 custom-scrollbar text-green-400/80 leading-relaxed">
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
                        <div ref={logEndRef}/>
                    </div>

                    <div
                        className="absolute bottom-10 right-10 flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
                        <Loader2 className="animate-spin text-blue-400" size={16}/>
                        <span className="text-white text-[10px] font-black uppercase tracking-widest">
              正在解析...
            </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ReportPhase: React.FC<{
    report: InspectionReport;
    onReset: () => void;
}> = ({report, onReset}) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                <button
                    onClick={onReset}
                    className="flex items-center gap-4 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-all text-sm font-black group px-8 py-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm active:scale-95"
                >
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform"/>
                    返回并重试审计
                </button>

                <div
                    className="flex items-center gap-5 px-8 py-4 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"/>
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
            最终审计报告 • {report.timestamp}
          </span>
                </div>
            </div>

            <ComplianceReport report={report}/>
        </div>
    );
};
