/**
 * UploadZone.tsx - 固件资源包上传组件
 *
 * 功能描述:
 *   - 支持拖拽上传和点击上传两种方式
 *   - 仅接受 .zip 格式的固件资源包
 *   - 显示已选择文件列表
 *   - 触发全链路 AI 审计流程
 *
 * 使用方式:
 *   - 拖拽文件到上传区域
 *   - 或者点击区域打开文件选择器
 *   - 点击"执行全链路 AI 审计"开始分析
 *
 * @module UploadZone
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 上传区域属性接口
 */
interface UploadZoneProps {
  /** 文件被接受时的回调函数 */
  onFilesAccepted: (
    files: File[],
    firmwareType: FirmwareType,
    checkScript: string,
    onProgress: (uploadedBytes: number, totalBytes: number) => void,
  ) => void;
  /** 是否正在处理中（上传按钮禁用状态） */
  isProcessing: boolean;
  isLoggedIn: boolean;
}

/**
 * 文件条目接口，用于渲染列表
 */
interface FileEntry {
  /** 唯一标识符 */
  id: string;
  /** 原始 File 对象 */
  file: File;
}

/**
 * 上传配置接口
 */
interface UploadConfig {
  /** 接受的文件扩展名 */
  acceptedExtensions: string[];
  /** 文件大小限制 (字节)，0 表示无限制 */
  maxFileSize: number;
  /** 错误提示显示时长 (毫秒) */
  errorDuration: number;
}

/**
 * 固件类型枚举
 */
type FirmwareType = 'AMI' | 'OpenBMC';

/**
 * 可选检查脚本选项
 */
interface CheckScriptOption {
  /** 脚本文件名 */
  value: string;
  /** 展示给用户看的名称 */
  label: string;
}

/**
 * 固件类型选项
 */
interface FirmwareTypeOption {
  /** 类型值 */
  value: FirmwareType;
  /** 显示标签 */
  label: string;
  /** 类型描述 */
  description: string;
}

// ============================================================================
// 常量配置
// ============================================================================

/**
 * 上传区域默认配置
 */
const DEFAULT_CONFIG: UploadConfig = {
  acceptedExtensions: ['.zip'],
  maxFileSize: 0,  // 0 表示无限制
  errorDuration: 3000,
};

/**
 * 可选的固件类型
 */
const FIRMWARE_TYPE_OPTIONS: FirmwareTypeOption[] = [
  { value: 'AMI', label: 'AMI', description: 'AMI BIOS 固件' },
  { value: 'OpenBMC', label: 'OpenBMC', description: 'OpenBMC 开源固件' },
] as const;

/**
 * 可选的检查脚本（后续如果有新版本脚本可以在此扩展）
 */
const CHECK_SCRIPT_OPTIONS: CheckScriptOption[] = [
  { value: 'CheckFWFile_v1.3.1.py', label: 'CheckFWFile_v1.3.1.py' },
] as const;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成唯一文件 ID
 *
 * 功能:
 *   - 使用时间戳 + 随机数生成唯一标识
 *   - 用于解决使用数组索引作为 key 的问题
 *
 * @returns 唯一标识符字符串
 */
const generateFileId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * 检查文件扩展名是否被接受
 *
 * @param filename - 文件名
 * @param acceptedExtensions - 接受的扩展名数组
 * @returns 是否被接受
 */
const isFileAccepted = (
  filename: string,
  acceptedExtensions: string[]
): boolean => {
  const lowerFilename = filename.toLowerCase();
  return acceptedExtensions.some(ext =>
    lowerFilename.endsWith(ext.toLowerCase())
  );
};

// ============================================================================
// 主组件
// ============================================================================

/**
 * UploadZone - 固件资源包上传组件
 *
 * 功能:
 *   - 提供拖拽上传区域
 *   - 提供点击上传功能
 *   - 验证文件格式（仅 .zip）
 *   - 显示文件列表
 *   - 触发审计流程
 *
 * 性能优化:
 *   - 使用 React.memo 避免不必要重渲染
 *   - 使用 useCallback 缓存回调函数
 *   - 文件使用唯一 ID 作为 key
 *
 * @param props - 组件属性
 * @returns 上传区域 JSX
 */
const UploadZone: React.FC<UploadZoneProps> = React.memo(({
  onFilesAccepted,
  isProcessing,
  isLoggedIn
}) => {
  // --------------------------------------------------------------------------
  // 状态定义
  // --------------------------------------------------------------------------

  /** 已选择的文件列表 */
  const [files, setFiles] = useState<FileEntry[]>([]);

  /** 是否处于拖拽激活状态 */
  const [dragActive, setDragActive] = useState(false);

  /** 选中的固件类型 */
  const [firmwareType, setFirmwareType] = useState<FirmwareType>('AMI');

  /** 选中的检查脚本文件名 */
  const [checkScript, setCheckScript] = useState<string>('CheckFWFile_v1.3.1.py');

  /** 错误提示信息 */
  const [error, setError] = useState<string | null>(null);

  /** 错误提示定时器引用 */
  const errorTimeoutRef = useRef<number | null>(null);

  /** 文件输入元素引用，用于重置 */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  /**
   * 清理定时器 Effect
   *
   * 功能:
   *   - 组件卸载时清理未完成的定时器
   *   - 防止内存泄漏
   */
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // 回调函数
  // --------------------------------------------------------------------------

  /**
   * 显示错误提示
   *
   * 功能:
   *   - 设置错误信息
   *   - 在指定时间后自动清除
   *
   * @param message - 错误信息
   */
  const showError = useCallback((message: string) => {
    // 清除之前的定时器
    if (errorTimeoutRef.current !== null) {
      window.clearTimeout(errorTimeoutRef.current);
    }

    setError(message);

    // 设置新的定时器
    errorTimeoutRef.current = window.setTimeout(() => {
      setError(null);
      errorTimeoutRef.current = null;
    }, DEFAULT_CONFIG.errorDuration);
  }, []);

  const appendFiles = useCallback((incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;

    const newEntries: FileEntry[] = incomingFiles.map(file => ({
      id: generateFileId(),
      file
    }));

    setFiles(prev => [...prev, ...newEntries]);
    setUploadProgress(null);
  }, []);

  /**
   * 验证文件列表
   *
   * 功能:
   *   - 过滤掉不接受的扩展名
   *   - 检查文件大小限制
   *   - 返回有效文件列表
   *
   * @param incomingFiles - 原始文件数组
   * @returns 验证后的有效文件数组
   */
  const validateFiles = useCallback((incomingFiles: File[]): File[] => {
    const validFiles: File[] = [];
    let invalidCount = 0;
    let oversizedCount = 0;

    for (const file of incomingFiles) {
      // 检查扩展名
      if (!isFileAccepted(file.name, DEFAULT_CONFIG.acceptedExtensions)) {
        invalidCount++;
        continue;
      }

      // 检查文件大小
      if (DEFAULT_CONFIG.maxFileSize > 0 && file.size > DEFAULT_CONFIG.maxFileSize) {
        oversizedCount++;
        continue;
      }

      // 检查重复文件
      if (files.some(existing => existing.file.name === file.name)) {
        continue;
      }

      validFiles.push(file);
    }

    // 生成错误信息
    if (invalidCount > 0) {
      showError(`已过滤 ${invalidCount} 个非 .zip 格式文件`);
    } else if (oversizedCount > 0) {
      showError(`${oversizedCount} 个文件超出大小限制`);
    }

    return validFiles;
  }, [files, showError]);

  /**
   * 处理拖拽事件
   *
   * 功能:
   *   - 阻止默认拖拽行为
   *   - 切换拖拽激活状态
   *
   * @param e - 拖拽事件
   */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      return;
    }

    const isActive = e.type === 'dragenter' || e.type === 'dragover';
    setDragActive(isActive);
  }, [isLoggedIn]);

  /**
   * 处理文件放置
   *
   * 功能:
   *   - 阻止默认放置行为
   *   - 获取并验证放置的文件
   *   - 更新文件列表
   *
   * @param e - 放置事件
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      return;
    }

    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(Array.from(e.dataTransfer.files));
      appendFiles(validFiles);
      if (validFiles.length > 0 && !isProcessing) {
        setUploadProgress(0);
        onFilesAccepted(
          validFiles,
          firmwareType,
          checkScript,
          (uploadedBytes, totalBytes) => {
            const ratio = totalBytes > 0 ? uploadedBytes / totalBytes : 0;
            const percent = Math.round(ratio * 100);
            setUploadProgress(percent);
          },
        );
      }
    }
  }, [appendFiles, validateFiles, isLoggedIn, isProcessing, onFilesAccepted, firmwareType, checkScript]);

  /**
   * 处理文件选择输入
   *
   * 功能:
   *   - 获取选择的文件
   *   - 验证并添加到列表
   *   - 重置输入元素
   *
   * @param e - 文件输入变化事件
   */
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isLoggedIn) {
      return;
    }

    if (e.target.files && e.target.files.length > 0) {
      const validFiles = validateFiles(Array.from(e.target.files));

      appendFiles(validFiles);

      if (validFiles.length > 0 && !isProcessing) {
        setUploadProgress(0);
        onFilesAccepted(
          validFiles,
          firmwareType,
          checkScript,
          (uploadedBytes, totalBytes) => {
            const ratio = totalBytes > 0 ? uploadedBytes / totalBytes : 0;
            const percent = Math.round(ratio * 100);
            setUploadProgress(percent);
          },
        );
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [appendFiles, validateFiles, isLoggedIn, isProcessing, onFilesAccepted, firmwareType, checkScript]);



  const getZoneClassName = useCallback((): string => {
    const baseClasses = `
      relative bg-white dark:bg-slate-900 rounded-[2.5rem] px-8 py-10
      md:px-10 md:py-12
      transition-all flex flex-col items-center justify-center text-center
      cursor-pointer group border-2 border-dashed
    `;

    if (dragActive) {
      return `${baseClasses} bg-blue-600/5 border-blue-600 scale-[1.02] shadow-2xl`;
    }

    return `${baseClasses} border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:bg-white/5 shadow-2xl`;
  }, [dragActive]);

  const handleZoneKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    e.preventDefault();

    if (!isLoggedIn) {
      return;
    }

    fileInputRef.current?.click();
  }, [isLoggedIn]);

  // --------------------------------------------------------------------------
  // 渲染
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* 上传区域 */}
      <div
        className={getZoneClassName()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => {
          if (!isProcessing && isLoggedIn) {
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={handleZoneKeyDown}
        aria-label="上传区域，拖拽文件或点击选择"
      >
        {/* 扫描线动画效果 */}
        <div className="scan-line pointer-events-none group-hover:block hidden" />

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip"
          className="hidden"
          onChange={handleFileInput}
          disabled={isProcessing || !isLoggedIn}
          aria-hidden="true"
        />

        {/* 上传图标 */}
        <div
          className={`
            bg-blue-600 p-6 md:p-8 rounded-[2rem] shadow-2xl shadow-blue-600/40 mb-6 md:mb-8
            group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700
          `}
        >
          <Box className="text-white" size={64} />
        </div>

        {/* 标题 */}
        <h3 className="text-2xl md:text-3xl font-black dark:text-white text-slate-900 mb-4 md:mb-5 tracking-tight uppercase">
          导入审计资源包
        </h3>

        {/* 说明文字 */}
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 md:mb-8 text-sm md:text-base font-medium leading-relaxed">
          请上传固件资源，仅支持{' '}
          <span className="text-blue-600 dark:text-blue-400 font-black">.ZIP</span>{' '}
          格式
        </p>

        {/* 标签 */}
        <div className="flex flex-wrap justify-center gap-4">
          {['完整 ZIP 包'].map(tag => (
            <span
              key={tag}
              className="px-6 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 固件类型选择器 */}
        <div className="flex flex-col gap-4 mt-8">
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              固件类型:
            </span>
            <div className="flex gap-3">
              {FIRMWARE_TYPE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // 阻止事件冒泡，避免触发文件选择
                    setFirmwareType(option.value);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation(); // 阻止键盘事件冒泡
                  }}
                  disabled={isProcessing || !isLoggedIn}
                  className={`
                    px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all
                    ${firmwareType === option.value
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:border-blue-400'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 检查脚本选择下拉框 */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              检查脚本:
            </span>
            <select
              value={checkScript}
              onChange={(e) => {
                e.stopPropagation();
                setCheckScript(e.target.value);
              }}
              onClick={(e) => {
                // 阻止点击冒泡，避免误触发文件选择
                e.stopPropagation();
              }}
              disabled={isProcessing || !isLoggedIn}
              className="
                px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest
                bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10
                text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500
              "
            >
              {CHECK_SCRIPT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 上传进度与错误提示 */}
        <div className="absolute bottom-8 inset-x-8 flex flex-col gap-2 pointer-events-none">
          {uploadProgress !== null && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <span>上传固件包中</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 text-rose-500 font-bold bg-rose-500/10 px-4 py-2 rounded-full w-fit"
              role="alert"
            >
              <AlertCircle size={16} aria-hidden="true" />
              <span className="text-[10px] uppercase tracking-wider">{error}</span>
            </div>
          )}
        </div>

        {!isLoggedIn && (
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertCircle size={48} className="text-rose-500 mb-4" />
            <h4 className="text-xl font-black text-white mb-2">请先登录</h4>
            <p className="text-slate-300 text-sm">未登录状态下无法使用导入审计功能</p>
          </div>
        )}
      </div>

      {/* 文件列表和提交按钮已移除：上传有效文件后自动触发分析 */}
    </div>
  );
});

// 设置 displayName 以便 React DevTools 正确显示
UploadZone.displayName = 'UploadZone';

export default UploadZone;
