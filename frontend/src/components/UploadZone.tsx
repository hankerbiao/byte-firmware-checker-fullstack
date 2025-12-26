
import React, { useState, useCallback } from 'react';
import { FileText, X, Sparkles, Box, Activity, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  onFilesAccepted: (files: File[]) => void;
  isProcessing: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFilesAccepted, isProcessing }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = (incomingFiles: File[]) => {
    const validFiles = incomingFiles.filter(file => file.name.toLowerCase().endsWith('.zip'));
    const invalidCount = incomingFiles.length - validFiles.length;
    
    if (invalidCount > 0) {
      setError(`已过滤 ${invalidCount} 个非 .zip 格式文件`);
      setTimeout(() => setError(null), 3000);
    }
    return validFiles;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      const validFiles = validateFiles(Array.from(e.dataTransfer.files));
      if (validFiles.length) setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const validFiles = validateFiles(Array.from(e.target.files));
      if (validFiles.length) setFiles(prev => [...prev, ...validFiles]);
      e.target.value = ''; // Reset
    }
  };

  return (
    <div className="space-y-8">
      <div 
        className={`relative bg-white dark:bg-slate-900 rounded-[4rem] p-20 transition-all flex flex-col items-center justify-center text-center cursor-pointer group border-2 border-dashed ${
          dragActive 
            ? 'bg-blue-600/5 border-blue-600 scale-[1.02] shadow-2xl' 
            : 'border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:bg-white/5 shadow-2xl'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="scan-line pointer-events-none group-hover:block hidden"></div>
        <input type="file" multiple accept=".zip" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileInput} disabled={isProcessing} />
        
        <div className="bg-blue-600 p-10 rounded-[3rem] shadow-2xl shadow-blue-600/40 mb-10 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700">
          <Box className="text-white" size={64} />
        </div>
        
        <h3 className="text-4xl font-black dark:text-white text-slate-900 mb-6 tracking-tight uppercase">导入审计资源包</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-12 text-lg font-medium leading-relaxed">
          请上传固件资源，仅支持 <span className="text-blue-600 dark:text-blue-400 font-black">.ZIP</span> 格式
        </p>
        
        <div className="flex flex-wrap justify-center gap-4">
          {['完整 ZIP 包', 'BIN 镜像', '测试报告', '校验凭证'].map(tag => (
            <span key={tag} className="px-6 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {tag}
            </span>
          ))}
        </div>

        {error && (
          <div className="absolute bottom-8 flex items-center gap-2 text-rose-500 font-bold animate-bounce bg-rose-500/10 px-6 py-2 rounded-full">
            <AlertCircle size={16} />
            <span className="text-xs uppercase tracking-wider">{error}</span>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {files.map((file, i) => (
              <div key={i} className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-lg group">
                <div className="flex items-center gap-5 overflow-hidden">
                  <div className="p-4 bg-blue-600/10 rounded-2xl text-blue-600 dark:text-blue-400">
                    <FileText size={26} />
                  </div>
                  <div className="overflow-hidden text-left">
                    <p className="text-base font-black dark:text-white text-slate-900 truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button 
                  onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-4 hover:bg-rose-500/10 rounded-2xl text-slate-400 hover:text-rose-500 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => onFilesAccepted(files)}
            className="w-full flex items-center justify-center gap-6 p-10 bg-blue-600 hover:bg-blue-500 text-white rounded-[3rem] font-black text-2xl transition-all shadow-xl group relative overflow-hidden"
          >
            <Sparkles size={36} className="animate-pulse" />
            执行全链路 AI 审计
            <Activity size={24} className="ml-4 opacity-0 group-hover:opacity-100 transition-all" />
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadZone;
