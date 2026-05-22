import React from 'react';
import { FileText, CheckCircle2, ShieldAlert, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCount } from '@/lib/format';
import { AnalyticsMetrics } from '@/types/kyc';

interface AnalyticsGridProps {
  metrics: AnalyticsMetrics;
}

export const AnalyticsGrid: React.FC<AnalyticsGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-6">
      
      {/* Total Processed Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-5 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
        <div className="flex items-center justify-between z-10">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Processed</span>
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between z-10">
          <div>
            <span className="text-3xl font-extrabold text-white glow-text-indigo tracking-tight">
              {formatCount(metrics.totalProcessed)}
            </span>
            <div className="flex items-center text-emerald-400 text-xs mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>+12.4% this week</span>
            </div>
          </div>
          {/* Decorative Sparkline */}
          <div className="w-16 h-8 opacity-60">
            <svg viewBox="0 0 100 50" className="w-full h-full text-indigo-400">
              <path
                d="M0,45 Q15,40 30,30 T60,25 T90,5 L100,5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Approval Rate Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-5 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
        <div className="flex items-center justify-between z-10">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Approval Rate</span>
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between z-10">
          <div>
            <span className="text-3xl font-extrabold text-white glow-text-emerald tracking-tight">
              {metrics.approvalRate}%
            </span>
            <div className="flex items-center text-emerald-400 text-xs mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>+0.8% increase</span>
            </div>
          </div>
          {/* Circular Progress Gauge */}
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                strokeWidth="3.5"
                strokeDasharray={`${metrics.approvalRate}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[9px] font-bold text-slate-300">OK</span>
          </div>
        </div>
      </div>

      {/* Active Fraud Alerts Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-5 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
        <div className="flex items-center justify-between z-10">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Fraud Alerts</span>
          <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400 border border-rose-500/20 animate-pulse-glow">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between z-10">
          <div>
            <span className="text-3xl font-extrabold text-rose-500 glow-text-rose tracking-tight">
              {metrics.activeFraudAlerts}
            </span>
            <div className="flex items-center text-rose-400 text-xs mt-1 font-medium">
              <TrendingDown className="w-3.5 h-3.5 mr-1" />
              <span>-3 cases this month</span>
            </div>
          </div>
          {/* Warning Grid Decorative Icon */}
          <div className="relative flex space-x-1 mb-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute inline-flex opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
            <span className="h-2 w-2 rounded-full bg-rose-600/30" />
            <span className="h-2 w-2 rounded-full bg-rose-600/10" />
          </div>
        </div>
      </div>

      {/* Avg Processing Time Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-5 relative overflow-hidden flex flex-col justify-between h-36">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
        <div className="flex items-center justify-between z-10">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Avg Processing Time</span>
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between z-10">
          <div>
            <span className="text-3xl font-extrabold text-white glow-text-amber tracking-tight">
              {metrics.avgProcessingTimeSec}s
            </span>
            <div className="flex items-center text-emerald-400 text-xs mt-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>-0.4s (optimized)</span>
            </div>
          </div>
          {/* Pulse Bar Graph */}
          <div className="flex items-end space-x-1 h-8">
            <div className="w-1.5 h-4 bg-amber-500/40 rounded-t-sm" />
            <div className="w-1.5 h-6 bg-amber-500/60 rounded-t-sm" />
            <div className="w-1.5 h-8 bg-amber-500 rounded-t-sm animate-pulse" />
            <div className="w-1.5 h-5 bg-amber-500/80 rounded-t-sm" />
            <div className="w-1.5 h-3 bg-amber-500/30 rounded-t-sm" />
          </div>
        </div>
      </div>

    </div>
  );
};
