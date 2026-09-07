import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Users,
  Server,
} from 'lucide-react';
import {
  getAdminStats,
  adminLogin,
  AdminStatsResponse,
  AdminLoginResponse,
  DailyTrendItem,
  CategoryDistributionItem,
} from '../api/client';
import { setSessionToken } from '../api/client';

/**
 * AdminDashboard - 管理员统计看板
 * 
 * 功能:
 * - 管理员登录入口（隐藏式，通过点击版本号触发）
 * - 使用统计数据展示（总审计数、通过率、趋势图等）
 * 
 * 状态机:
 * - 'login' → 显示管理员登录表单
 * - 'loading' → 数据加载中
 * - 'dashboard' → 显示统计看板
 */
const AdminDashboard: React.FC = () => {
  const [phase, setPhase] = useState<'login' | 'loading' | 'dashboard'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('core-audit-admin-token');
  });

  // Auto-load stats if token exists on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('core-audit-admin-token');
    if (savedToken) {
      setSessionToken(savedToken);
      setPhase('loading');
      fetchStats();
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    setStatsError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
      setPhase('dashboard');
    } catch (err: any) {
      setStatsError(err.message || 'Failed to fetch stats');
      if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
        setAdminToken(null);
        localStorage.removeItem('core-audit-admin-token');
        setPhase('login');
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    setLoginError(null);
    try {
      const result: AdminLoginResponse = await adminLogin({ username, password });
      if (result.ok && result.token) {
        setSessionToken(result.token);
        setAdminToken(result.token);
        localStorage.setItem('core-audit-admin-token', result.token);
        fetchStats();
      } else {
        setLoginError('用户名或密码错误');
      }
    } catch (err: any) {
      setLoginError(err.message || '登录失败');
    }
  }, [username, password, fetchStats]);

  const handleLogout = useCallback(() => {
    setAdminToken(null);
    setSessionToken(null);
    localStorage.removeItem('core-audit-admin-token');
    localStorage.removeItem('core-audit-session-token');
    setStats(null);
    setUsername('');
    setPassword('');
    setPhase('login');
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // Stats card component
  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    trend?: 'up' | 'down' | null;
    trendValue?: string;
  }> = React.memo(({ title, value, icon, color, trend, trendValue }) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-6 hover:border-blue-500/40 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${color}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
            trend === 'up' 
              ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
          }`}>
            {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trendValue}
          </span>
        )}
      </div>
      <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</div>
    </div>
  ));

  if (phase === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-10">
            <div className="flex flex-col items-center mb-8">
              <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-600/30 mb-4">
                <ShieldCheck className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">管理员登录</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">仅供授权管理员访问</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 block">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="输入管理员用户名"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 block">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="输入管理员密码"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              {loginError && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 rounded-2xl px-4 py-3">
                  {loginError}
                </div>
              )}
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all active:scale-[0.98]"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading' || refreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">加载中...</p>
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
        <div className="text-center">
          <XCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">数据加载失败</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{statsError}</p>
          <button
            onClick={fetchStats}
            className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const {
    totalAudits,
    completedAudits,
    failedAudits,
    analyzingAudits,
    passRate,
    firmwareTypeDistribution,
    dailyTrend,
    categoryDistribution,
    uniqueUsers,
    updatedAt,
  } = stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">系统使用统计</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              更新时间: {formatDate(updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="px-4 py-2 text-sm font-bold rounded-2xl border border-slate-200 dark:border-white/20 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-all disabled:opacity-60"
            >
              {refreshing ? <Loader2 size={16} className="animate-spin inline mr-2" /> : null}
              刷新数据
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-bold rounded-2xl bg-red-600 text-white hover:bg-red-500 transition-all"
            >
              退出登录
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            title="总审计任务"
            value={totalAudits}
            icon={<Server size={24} className="text-blue-600 dark:text-blue-400" />}
            color="bg-blue-100 dark:bg-blue-500/10"
          />
          <StatCard
            title="已完成"
            value={completedAudits}
            icon={<CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />}
            color="bg-green-100 dark:bg-green-500/10"
            trend="up"
            trendValue={`${completedAudits}`}
          />
          <StatCard
            title="通过/失败"
            value={`${passRate}%`}
            icon={passRate >= 80 ? <ShieldCheck size={24} className="text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />}
            color={passRate >= 80 ? "bg-emerald-100 dark:bg-emerald-500/10" : "bg-amber-100 dark:bg-amber-500/10"}
            trend={passRate >= 80 ? 'up' : 'down'}
            trendValue={`${passRate}%`}
          />
          <StatCard
            title="活跃用户"
            value={uniqueUsers}
            icon={<Users size={24} className="text-purple-600 dark:text-purple-400" />}
            color="bg-purple-100 dark:bg-purple-500/10"
          />
        </div>

        {/* Daily Trend Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-8 mb-8">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            最近7天审计趋势
          </h3>
          {dailyTrend.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">暂无趋势数据</p>
          ) : (
            <div className="flex items-end gap-3 h-64">
              {dailyTrend.map((day: DailyTrendItem) => {
                const maxTotal = Math.max(...dailyTrend.map(d => d.total), 1);
                const height = Math.max((day.total / maxTotal) * 100, 4);
                const passedHeight = day.total > 0 ? (day.passed / day.total) * 100 : 0;
                const failedHeight = day.total > 0 ? (day.failed / day.total) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <div className="w-full relative flex flex-col justify-end h-48 rounded-2xl overflow-hidden">
                      {/* Passed portion */}
                      <div
                        className="absolute bottom-0 w-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                        style={{ height: `${passedHeight}%` }}
                      />
                      {/* Failed portion */}
                      <div
                        className="absolute bottom-0 w-full bg-red-500 dark:bg-red-400 transition-all"
                        style={{ height: `${failedHeight}%`, bottom: `${passedHeight}%` }}
                      />
                      {/* Unanalyzed portion */}
                      <div
                        className="absolute bottom-0 w-full bg-slate-200 dark:bg-slate-600 transition-all"
                        style={{ height: `${100 - passedHeight - failedHeight}%`, bottom: '0' }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {day.date.slice(5)}
                    </div>
                    <div className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                      {day.total}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {dailyTrend.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">已完成</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">失败</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">分析中</span>
              </div>
            </div>
          )}
        </div>

        {/* Firmware Type Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-600" />
              固件类型分布
            </h3>
            <div className="space-y-4">
              {Object.entries(firmwareTypeDistribution || {}).map(([type, count]) => {
                const c = count as number;
                const percentage = totalAudits > 0 ? Math.round((c / totalAudits) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{type}</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{c} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              检查项分类统计
            </h3>
            <div className="space-y-3">
              {categoryDistribution
                .sort((a, b) => b.count - a.count)
                .map((item: CategoryDistributionItem, idx: number) => (
                  <div key={item.category} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-200">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.category}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{item.count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-black mb-2">{totalAudits}</div>
              <div className="text-sm opacity-80 uppercase tracking-wider font-bold">总审计次数</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-2">{passRate}%</div>
              <div className="text-sm opacity-80 uppercase tracking-wider font-bold">总体通过率</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-2">{uniqueUsers}</div>
              <div className="text-sm opacity-80 uppercase tracking-wider font-bold">活跃用户数</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;