import React, { useState } from 'react';
import { LogIn, Loader2, User, Lock } from 'lucide-react';

export interface LoginButtonProps {
  /**
   * 是否正在加载中
   * @default false
   */
  loading?: boolean;

  /**
   * 按钮大小
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * 按钮变体
   * @default "primary"
   */
  variant?: 'primary' | 'outline' | 'ghost';

  /**
   * 点击事件处理函数
   * @param credentials - 登录凭据
   * @returns Promise<void>
   */
  onLogin?: (credentials: { email: string; password: string }) => Promise<void>;

  /**
   * 自定义样式类名
   */
  className?: string;

  /**
   * 是否禁用按钮
   * @default false
   */
  disabled?: boolean;
}

/**
 * 登录按钮组件
 *
 * 一个符合项目设计风格的现代化登录按钮，支持多种样式和交互状态。
 *
 * @example
 * ```tsx
 * // 基础使用
 * <LoginButton onLogin={handleLogin} />
 *
 * // 带加载状态
 * <LoginButton loading={isLoading} onLogin={handleLogin} />
 *
 * // 不同尺寸
 * <LoginButton size="lg" onLogin={handleLogin} />
 * ```
 */
export const LoginButton: React.FC<LoginButtonProps> = ({
  loading = false,
  size = 'md',
  variant = 'primary',
  onLogin,
  className = '',
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base'
  };

  const iconSizes = {
    sm: 18,
    md: 20,
    lg: 24
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onLogin && !loading && !disabled) {
      await onLogin({ email, password });
    }
  };

  const toggleExpanded = () => {
    if (!loading && !disabled) {
      setIsExpanded(!isExpanded);
    }
  };

  if (isExpanded) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute top-0 right-0 w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/30">
              <LogIn size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">
                用户登录
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                进入智能审计系统
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-widest">
                邮箱地址
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={16} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 dark:focus:border-blue-400 transition-all"
                  disabled={loading || disabled}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2 uppercase tracking-widest">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={16} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 dark:focus:border-blue-400 transition-all"
                  disabled={loading || disabled}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="submit"
                disabled={loading || disabled || !email || !password}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={iconSizes[size]} className="animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn size={iconSizes[size]} />
                    立即登录
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={toggleExpanded}
                disabled={loading}
                className="px-4 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-sm font-black"
              >
                取消
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/5">
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em]">
              安全加密传输 • 符合行业安全标准
            </p>
          </div>
        </div>

        {/* 点击外部关闭 */}
        <div
          className="fixed inset-0 -z-10"
          onClick={toggleExpanded}
          aria-hidden="true"
        />
      </div>
    );
  }

  const baseClasses = 'font-black transition-all shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 flex items-center gap-2 rounded-2xl';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:shadow-blue-600/30',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-600/10',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
  };

  return (
    <button
      onClick={toggleExpanded}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
        ${className}
      `}
    >
      {loading ? (
        <Loader2 size={iconSizes[size]} className="animate-spin" />
      ) : (
        <LogIn size={iconSizes[size]} />
      )}
      <span>登录</span>
    </button>
  );
};

export default LoginButton;