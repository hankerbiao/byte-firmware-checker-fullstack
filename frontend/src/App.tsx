import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  History,
  Search,
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
import UploadZone from './components/UploadZone';
import ComplianceReport from './components/ComplianceReport';
import { InspectionReport, FirmwareType } from './types';
import { MOCK_CHECKLIST, MOCK_FILES } from './constants';

// --- 子组件: 导航栏 (NavBar) ---
const NavBar: React.FC<{ darkMode: boolean; toggleTheme: () => void; onReset: () => void }> = ({ darkMode, toggleTheme, onReset }) => (
  <nav className="w-full max-w-7xl px-8 h-20 flex items-center justify-between z-40 sticky top-0 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-white/5 transition-colors">
    <div className="flex items-center gap-4 cursor-pointer group" onClick={onReset}>
      <div className="bg-blue-600 p-2.5 rounded-2xl shadow-xl shadow-blue-600/30 group-hover:rotate-[15deg] transition-all">
        <ShieldCheck className="text-white" size={26} />
      </div>
      <div>
        <h1 className="font-black text-2xl tracking-tighter dark:text-white text-slate-900 uppercase leading-none">
          Core <span className="text-blue-600 dark:text-blue-400">Audit</span>
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">AI 审计引擎在线</p>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 mr-2">
        <Search size={14} className="text-slate-400" />
        <input placeholder="搜索审计单..." className="bg-transparent border-none text-xs dark:text-white text-slate-900 focus:outline-none w-32 placeholder:text-slate-400 font-bold" />
      </div>
      <button onClick={toggleTheme} className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl hover:scale-105 transition-all border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"></div>
      <button className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all">
        <History size={18} /> 审计历史
      </button>
      <button className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95">
        控制台
      </button>
    </div>
  </nav>
);

// --- 子组件: 页脚 (Footer) ---
const Footer: React.FC = () => (
  <footer className="w-full max-w-7xl px-8 py-12 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center text-slate-400 text-[11px] gap-8 mt-auto font-black uppercase tracking-[0.25em]">
    <div className="flex items-center gap-4">
      <div className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-500 rounded-lg border border-green-500/20">
        System Online
      </div>
      通用固件合规审计平台 v4.2.0
    </div>
    <div className="flex items-center gap-10">
      <a href="#" className="hover:text-blue-600 dark:hover:text-white transition-all">隐私与合规</a>
      <a href="#" className="hover:text-blue-600 dark:hover:text-white transition-all">审计准则</a>
      <p className="text-slate-300 dark:text-slate-800 opacity-50">© 2025 Core Intelligence Hub</p>
    </div>
  </footer>
);

const App: React.FC = () => {
  const [phase, setPhase] = useState<'upload' | 'analyzing' | 'report'>('upload');
  const [currentReport, setCurrentReport] = useState<InspectionReport | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [analysisLogs, setAnalysisLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.classList.toggle('light', !darkMode);
  }, [darkMode]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysisLogs]);

  const handleStartAnalysis = (files: File[]) => {
    setPhase('analyzing');
    setAnalysisLogs(["[INFO] 正在初始化审计环境...", "[INFO] 文件完整性校验开始..."]);

    const mockLogs = [
      "[INFO] 正在解压资源包...",
      "[SYSTEM] 识别到 BIOS 固件镜像 (32MB)",
      "[DEBUG] 正在提取哈希摘要: SHA-256...",
      "[INFO] 开始目录结构合规性扫描...",
      "[AI] 正在分析 Release Note 文本内容...",
      "[WARN] 识别到子目录命名异常: /Tools/中文路径",
      "[AI] 执行跨文档一致性比对逻辑...",
      "[INFO] 正在调用 NIST SP 800 知识库比对...",
      "[SUCCESS] 审计任务核心流程执行完毕",
      "[INFO] 正在整理并生成 PDF 报告单..."
    ];

    mockLogs.forEach((log, index) => {
      setTimeout(() => {
        setAnalysisLogs(prev => [...prev, log]);
      }, 500 * (index + 1));
    });

    setTimeout(() => {
      setCurrentReport({
        id: `AUDIT-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleString(),
        firmwareType: FirmwareType.BIOS,
        productName: "Alpha-Core 企业级服务器",
        version: "v5.2.0-LTS 稳定版",
        overallScore: 91,
        checks: MOCK_CHECKLIST,
        fileStructure: MOCK_FILES,
        trend: { fix: 5, new: 2 }
      });
      setPhase('report');
    }, 6000);
  };

  const reset = () => {
    setPhase('upload');
    setCurrentReport(null);
    setAnalysisLogs([]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center transition-all duration-700 ease-in-out">
      <NavBar darkMode={darkMode} toggleTheme={() => setDarkMode(!darkMode)} onReset={reset} />

      <main className="w-full max-w-7xl px-8 py-10 flex-1 flex flex-col relative z-20">
        {phase === 'upload' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 items-center flex-1">
            <div className="xl:col-span-5 space-y-12 animate-in fade-in slide-in-from-left-12 duration-1000">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 dark:border-blue-500/20">
                  <Activity size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">符合行业标准规范</span>
                </div>
                <h2 className="text-6xl font-black dark:text-white text-slate-900 leading-[1.05] tracking-tight">
                  引领固件包<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">智能自动化</span><br/>合规自查
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xl leading-relaxed font-medium">
                  基于先进的大语言模型与启发式扫描技术。秒级完成包结构审计、风险项智能预判，确保您的固件万无一失。
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {[
                  { icon: BrainCircuit, title: '认知分析', desc: '基于 NLP 的非结构化测试报告深度理解' },
                  { icon: Terminal, title: '结构一致性', desc: '多层级目录与命名规范自动对齐校验' },
                  { icon: Zap, title: '瞬时反馈', desc: '集成化自查，将平均评审周期缩短 70%' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-6 p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all group shadow-sm">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                      <item.icon size={26} />
                    </div>
                    <div>
                      <h4 className="font-black dark:text-white text-slate-900 text-lg tracking-tight">{item.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-7 animate-in fade-in slide-in-from-right-12 duration-1000">
              <UploadZone onFilesAccepted={handleStartAnalysis} isProcessing={false} />
            </div>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex flex-col items-center justify-center flex-1 py-12 animate-in fade-in scale-95 duration-1000">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
              <div className="flex flex-col items-center space-y-12 text-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-600/20 dark:bg-blue-500/10 blur-[100px] rounded-full"></div>
                  <div className="relative w-72 h-72 flex items-center justify-center">
                    <div className="absolute inset-0 border-8 border-slate-100 dark:border-white/5 rounded-full"></div>
                    <div className="absolute inset-0 border-t-8 border-blue-600 dark:border-blue-400 rounded-full animate-spin-slow"></div>
                    <div className="relative z-10 p-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-white/10">
                       <Bot size={80} className="text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">AI 引擎深度审计中</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">正在执行 Cross-Document 逻辑闭环校验...</p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[3rem] p-10 h-[500px] flex flex-col border border-white/10 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 ml-4 font-bold uppercase tracking-widest">Auditor Console v4.2</span>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-3 custom-scrollbar text-green-400/80 leading-relaxed">
                  {analysisLogs.map((log, i) => (
                    <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                      <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                      <span className={log.includes('[WARN]') ? 'text-amber-400' : log.includes('[SUCCESS]') ? 'text-green-400 font-bold' : ''}>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
                <div className="absolute bottom-10 right-10 flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-xl">
                   <Loader2 className="animate-spin text-blue-400" size={16} />
                   <span className="text-white text-[10px] font-black uppercase tracking-widest">正在解析...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'report' && currentReport && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
              <button
                onClick={reset}
                className="flex items-center gap-4 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition-all text-sm font-black group px-8 py-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm active:scale-95"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                返回并重试审计
              </button>

              <div className="flex items-center gap-5 px-8 py-4 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                  最终审计报告 • {currentReport.timestamp}
                </span>
              </div>
            </div>
            <ComplianceReport report={currentReport} />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;