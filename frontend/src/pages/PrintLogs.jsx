import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPrintLogs, getPrintStats } from '../api';
import PageLoading from '../components/PageLoading';

const STATUS_STYLE = {
  finished: { cls: 'bg-brand-500/20 text-brand-200', label: '✓ Finished' },
  failed:   { cls: 'bg-red-500/15 text-red-400',     label: '✗ Failed' },
  running:  { cls: 'bg-brand-400/20 text-brand-200',  label: '⟳ Running' },
  started:  { cls: 'bg-gold/15 text-gold',            label: '↑ Started' },
  cancelled:{ cls: 'bg-white/[0.06] text-gray-400',   label: '— Cancelled' }
};

const fmtDate = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDur  = (min) => min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;

function StatCard({ label, value, sub }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-brand-300 leading-none">{value}</div>
      <div className="text-sm font-medium text-gray-300 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function PrintLogs() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('status') || '';

  const setFilter = (s) => setSearchParams(s ? { status: s } : {}, { replace: true });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['print-logs', filter],
    queryFn: () => getPrintLogs(filter),
  });

  const { data: stats } = useQuery({
    queryKey: ['print-stats'],
    queryFn: getPrintStats,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['print-logs'] });
    qc.invalidateQueries({ queryKey: ['print-stats'] });
  };

  if (logsLoading) return <PageLoading />;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">Print Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Material usage and print history across all printers</p>
        </div>
        <button
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 text-sm transition-all"
          onClick={refresh}
        >↻ Refresh</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7 animate-fade-in">
          <StatCard label="Total Prints" value={stats.total} />
          <StatCard label="Success Rate" value={`${stats.successRate}%`} sub={`${stats.finished} finished`} />
          <StatCard label="Failed" value={stats.failed} sub="prints" />
          <StatCard label="Filament Used" value={`${stats.totalFilamentGrams}g`} sub={`${(stats.totalFilamentMm / 1000).toFixed(1)}m total`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {['', 'running', 'finished', 'failed', 'cancelled'].map(s => (
          <button
            key={s}
            className={`text-xs px-3 py-1.5 rounded-md transition-all ${
              filter === s
                ? 'bg-brand-500/80 text-gray-200 font-medium'
                : 'bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08]'
            }`}
            onClick={() => setFilter(s)}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden animate-fade-in">
        <div className="grid grid-cols-[1fr_1fr_100px_90px_90px_80px] gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">File</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Printer</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Status</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Duration</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Filament</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Date</span>
        </div>

        {logs.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            No print logs yet. Start a print from the Printers tab.
          </div>
        )}

        {logs.map(log => {
          const s = STATUS_STYLE[log.status] || STATUS_STYLE.started;
          return (
            <div key={log._id} className="grid grid-cols-[1fr_1fr_100px_90px_90px_80px] gap-3 px-4 py-3 border-b border-white/[0.04] items-center text-[13px]">
              <div>
                <div className="font-medium text-gray-200">{log.fileName || log.version?.originalName || '—'}</div>
                {log.version?.version && (
                  <div className="text-[11px] text-gray-500">{log.version.version}</div>
                )}
              </div>
              <div className="text-gray-400">
                {log.printer?.name || '—'}
                <div className="text-[11px]">{log.printer?.model}</div>
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>
                  {s.label}
                </span>
              </div>
              <div className="text-gray-400">
                {log.durationMinutes ? fmtDur(log.durationMinutes) : '—'}
              </div>
              <div>
                {log.filamentUsedGrams > 0 ? (
                  <div>
                    <span className="font-medium text-gray-200">{log.filamentUsedGrams}g</span>
                    <div className="text-[11px] text-gray-500">{(log.filamentUsedMm / 1000).toFixed(1)}m</div>
                  </div>
                ) : '—'}
              </div>
              <div className="text-[11px] text-gray-500">
                {fmtDate(log.startedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
