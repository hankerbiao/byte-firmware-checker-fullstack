import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AdminStatsResponse,
  AdminUserStat,
  getAdminUsageStats,
} from '../api/client';

interface OperationsDashboardProps {
  user: Record<string, unknown>;
  onBack: () => void;
}

type Scope = 'overview' | 'users';

interface QueryFilters {
  days: string;
  userId: string;
  firmwareType: string;
  status: string;
}

const DEFAULT_FILTERS: QueryFilters = {
  days: '30',
  userId: '',
  firmwareType: '',
  status: '',
};

const numberFormatter = new Intl.NumberFormat('zh-CN');

const formatNumber = (value: number) => numberFormatter.format(value || 0);

const formatDate = (value?: string | null) => {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getUserPassRate = (user?: AdminUserStat | null) => {
  if (!user) return 0;
  const finished = user.completedAudits + user.failedAudits;
  return finished > 0 ? Math.round((user.completedAudits / finished) * 100) : 0;
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}> = ({ label, value, detail, icon, tone }) => (
  <div className="border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
    <div className="mb-6 flex items-start justify-between">
      <div className={`grid h-10 w-10 place-items-center border ${tone}`}>{icon}</div>
      <Activity size={16} className="text-slate-300 dark:text-slate-600" />
    </div>
    <p className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
    <p className="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">{detail}</p>
  </div>
);

const OperationsDashboard: React.FC<OperationsDashboardProps> = ({ user, onBack }) => {
  const [scope, setScope] = useState<Scope>('overview');
  const [filters, setFilters] = useState<QueryFilters>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [userDirectory, setUserDirectory] = useState<AdminUserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const adminName = String(user['姓名'] || user['真实姓名'] || user.itcode || '管理员');
  const department = String(user['部门'] || '信息系统开发部');

  const loadStats = async (nextFilters: QueryFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminUsageStats(nextFilters);
      setStats(result);
      if (!nextFilters.userId && result.userStats?.length) {
        setUserDirectory(result.userStats);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message === 'FORBIDDEN' ? '当前账号没有运行看板权限' : '统计查询失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats(DEFAULT_FILTERS);
  }, []);

  const selectedUser = useMemo(
    () => userDirectory.find(item => item.itcode === filters.userId) || null,
    [filters.userId, userDirectory],
  );

  const updateFilter = (key: keyof QueryFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setScope('overview');
    void loadStats(DEFAULT_FILTERS);
  };

  const handleScopeChange = (nextScope: Scope) => {
    setScope(nextScope);
    if (nextScope === 'overview' && filters.userId) {
      const nextFilters = { ...filters, userId: '' };
      setFilters(nextFilters);
      void loadStats(nextFilters);
    }
  };

  const handleUserFocus = (itcode: string) => {
    const nextFilters = { ...filters, userId: itcode };
    setScope('users');
    setFilters(nextFilters);
    void loadStats(nextFilters);
  };

  const currentUser = scope === 'users' ? selectedUser : null;
  const totalAudits = stats?.totalAudits || 0;
  const completedAudits = stats?.completedAudits || 0;
  const failedAudits = stats?.failedAudits || 0;
  const activeAudits = stats?.analyzingAudits || 0;
  const finishedAudits = completedAudits + failedAudits;
  const passRate = finishedAudits > 0
    ? Math.round((completedAudits / finishedAudits) * 100)
    : 0;
  const maxTrend = Math.max(...(stats?.dailyTrend || []).map(item => item.total), 1);
  const maxCategory = Math.max(...(stats?.categoryDistribution || []).map(item => item.count), 1);

  return (
    <div className="min-h-[calc(100vh-5rem)] w-full bg-slate-100 px-4 py-6 dark:bg-[#0b1322] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-slate-200 pb-6 dark:border-white/10">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
                <span className="h-2 w-2 bg-cyan-500 dark:bg-cyan-300" />
                Operations dashboard
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                运行看板
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-white/50">
                查看平台为多少用户提供服务、完成了多少审计事项，以及不同用户的实际使用情况。
              </p>
            </div>
            <div className="flex items-center gap-3 border-l-2 border-cyan-500 bg-white px-4 py-3 dark:border-cyan-300 dark:bg-white/[0.05]">
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-white/40">统计管理员</p>
                <p className="mt-1 font-black text-slate-900 dark:text-white">{adminName}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-white/40">{department}</p>
              </div>
              <ShieldCheck className="text-cyan-600 dark:text-cyan-300" size={22} />
            </div>
          </div>
        </header>

        <section className="mb-6 border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70 sm:p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Filter size={17} className="text-cyan-600 dark:text-cyan-300" />
              <h2 className="text-sm font-black text-slate-900 dark:text-white">查询条件</h2>
              <span className="text-xs text-slate-400 dark:text-white/35">按条件刷新统计结果</span>
            </div>
            <div className="flex border border-slate-200 p-1 dark:border-white/10" role="tablist" aria-label="统计范围">
              {([
                { id: 'overview', label: '总览' },
                { id: 'users', label: '用户使用情况' },
              ] as const).map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={scope === item.id}
                  onClick={() => handleScopeChange(item.id)}
                  className={`px-3 py-2 text-xs font-black transition-colors ${
                    scope === item.id
                      ? 'bg-slate-900 text-white dark:bg-cyan-300 dark:text-slate-950'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-white/45 dark:hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-white/45">统计周期</span>
              <select
                value={filters.days}
                onChange={event => updateFilter('days', event.target.value)}
                className="w-full appearance-none border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              >
                <option value="7">近 7 天</option>
                <option value="30">近 30 天</option>
                <option value="90">近 90 天</option>
                <option value="365">近 1 年</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 bottom-3 text-slate-400" size={15} />
            </label>

            <label className="relative">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-white/45">用户</span>
              <select
                value={filters.userId}
                onChange={event => updateFilter('userId', event.target.value)}
                className="w-full appearance-none border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              >
                <option value="">全部注册用户</option>
                {userDirectory.map(item => (
                  <option key={item.itcode} value={item.itcode}>
                    {item.name} ({item.itcode})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 bottom-3 text-slate-400" size={15} />
            </label>

            <label className="relative">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-white/45">固件类型</span>
              <select
                value={filters.firmwareType}
                onChange={event => updateFilter('firmwareType', event.target.value)}
                className="w-full appearance-none border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              >
                <option value="">全部类型</option>
                <option value="BIOS">BIOS</option>
                <option value="BMC">BMC</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 bottom-3 text-slate-400" size={15} />
            </label>

            <label className="relative">
              <span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-white/45">任务状态</span>
              <select
                value={filters.status}
                onChange={event => updateFilter('status', event.target.value)}
                className="w-full appearance-none border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              >
                <option value="">全部状态</option>
                <option value="COMPLETED">已完成</option>
                <option value="FAILED">失败</option>
                <option value="ACTIVE">进行中</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 bottom-3 text-slate-400" size={15} />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void loadStats()}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 bg-slate-900 px-3 py-2.5 text-sm font-black text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                查询
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="重置筛选条件"
                className="grid h-[42px] w-[42px] place-items-center border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/10"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 flex items-center gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <XCircle size={17} />
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={scope === 'users' && currentUser ? '当前用户' : '注册用户数'} value={scope === 'users' && currentUser ? currentUser.name : formatNumber(stats?.uniqueUsers || 0)} detail={scope === 'users' && currentUser ? currentUser.itcode : '已产生使用记录的注册用户'} icon={<Users size={20} />} tone="border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300" />
          <MetricCard label="审计任务数" value={formatNumber(totalAudits)} detail="当前查询条件内的任务总量" icon={<BarChart3 size={20} />} tone="border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300" />
          <MetricCard label="已完成任务" value={formatNumber(completedAudits)} detail={`失败 ${formatNumber(failedAudits)} · 进行中 ${formatNumber(activeAudits)}`} icon={<CheckCircle2 size={20} />} tone="border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300" />
          <MetricCard label="完成通过率" value={`${passRate}%`} detail="已完成与失败任务的结果比例" icon={<Clock3 size={20} />} tone="border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70 sm:p-7">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">Activity trend</p>
                <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">任务运行趋势</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/45">按日统计当前筛选条件下的任务量</p>
              </div>
              <span className="text-xs text-slate-400 dark:text-white/35">近 {filters.days} 天</span>
            </div>
            {stats?.dailyTrend?.length ? (
              <div className="flex h-56 items-end gap-2 border-b border-l border-slate-200 px-3 dark:border-white/10 sm:gap-4 sm:px-5">
                {stats.dailyTrend.map(item => (
                  <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-white/50">{item.total}</span>
                    <div className="flex h-[78%] w-full items-end">
                      <div className="w-full bg-cyan-500 dark:bg-cyan-300" style={{ height: `${Math.max((item.total / maxTrend) * 100, 4)}%` }} />
                    </div>
                    <span className="truncate text-[10px] text-slate-400 dark:text-white/35">{item.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid h-56 place-items-center border border-dashed border-slate-200 text-sm text-slate-400 dark:border-white/10 dark:text-white/35">
                当前条件暂无趋势数据
              </div>
            )}
          </section>

          <section className="border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70 sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">Distribution</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">固件类型分布</h2>
            <div className="mt-7 space-y-5">
              {Object.entries(stats?.firmwareTypeDistribution || {}).length ? Object.entries(stats?.firmwareTypeDistribution || {}).map(([type, count]) => (
                <div key={type}>
                  <div className="mb-2 flex justify-between text-xs font-bold">
                    <span className="text-slate-600 dark:text-white/65">{type}</span>
                    <span className="text-slate-400 dark:text-white/40">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-white/10">
                    <div className="h-full bg-amber-400" style={{ width: `${Math.max((Number(count) / Math.max(totalAudits, 1)) * 100, 3)}%` }} />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-400 dark:text-white/35">当前条件暂无分布数据</p>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-center sm:px-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">Registered users</p>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">注册用户使用情况</h2>
            </div>
            <p className="text-xs text-slate-400 dark:text-white/35">点击用户可按该用户重新查询</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-400 dark:bg-white/[0.03] dark:text-white/35">
                <tr>
                  <th className="px-5 py-3 sm:px-7">用户</th>
                  <th className="px-5 py-3">部门</th>
                  <th className="px-5 py-3">任务总数</th>
                  <th className="px-5 py-3">已完成</th>
                  <th className="px-5 py-3">失败</th>
                  <th className="px-5 py-3">通过率</th>
                  <th className="px-5 py-3">最近使用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {userDirectory.length ? userDirectory.map(item => (
                  <tr key={item.itcode} className={`cursor-pointer transition-colors hover:bg-cyan-50/70 dark:hover:bg-cyan-400/[0.06] ${filters.userId === item.itcode ? 'bg-cyan-50 dark:bg-cyan-400/[0.08]' : ''}`} onClick={() => handleUserFocus(item.itcode)}>
                    <td className="px-5 py-4 sm:px-7">
                      <div className="font-black text-slate-800 dark:text-white">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.itcode}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 dark:text-white/45">{item.department || '未填写'}</td>
                    <td className="px-5 py-4 font-black text-slate-700 dark:text-white">{formatNumber(item.totalAudits)}</td>
                    <td className="px-5 py-4 text-emerald-600 dark:text-emerald-300">{formatNumber(item.completedAudits)}</td>
                    <td className="px-5 py-4 text-rose-600 dark:text-rose-300">{formatNumber(item.failedAudits)}</td>
                    <td className="px-5 py-4 font-bold text-slate-700 dark:text-white">{getUserPassRate(item)}%</td>
                    <td className="px-5 py-4 text-xs text-slate-400 dark:text-white/40">{formatDate(item.lastActive)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400 dark:text-white/35">
                      暂无注册用户使用记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400 dark:border-white/10 dark:text-white/35 sm:flex-row sm:items-center">
          <span>数据更新时间：{formatDate(stats?.updatedAt)}</span>
          <button type="button" onClick={onBack} className="font-bold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300">
            返回工作台
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;
