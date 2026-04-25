export default function VersionList({ title = 'Version History', versions, isLoading, selectedId, onSelect, onDelete, onDownload, fmt, fmtDate, onUpload }) {
  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {title}{isLoading ? '' : ` (${versions.length})`}
        </span>
        {onUpload && (
          <button
            className="text-[11px] font-medium px-3 py-1 rounded-md bg-brand-500/80 text-gray-200 hover:bg-brand-500 transition-all"
            onClick={onUpload}
          >
            ↑ Upload
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-6 text-center">
          <div className="spinner mx-auto mb-2" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && versions.length === 0 && (
        <div className="py-6 text-center text-sm text-gray-500">
          No versions yet
        </div>
      )}

      {/* Version rows */}
      {!isLoading && versions.map(v => (
        <div
          key={v._id}
          className={`flex flex-col gap-1.5 px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-all duration-100
            ${selectedId === v._id
              ? 'bg-brand-500/15 border-l-[3px] border-l-gold'
              : 'hover:bg-white/[0.03]'
            }`}
          onClick={() => onSelect(v)}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-200">{v.version}</span>
            {v.isLatest && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/30 text-brand-200">
                Latest
              </span>
            )}
            <div className="ml-auto flex gap-1">
              <button
                className="text-xs px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
                onClick={e => { e.stopPropagation(); onDownload(v); }}
              >↓</button>
              {onDelete && (
                <button
                  className="text-xs px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                  onClick={e => { e.stopPropagation(); onDelete(v._id); }}
                ><svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-400 truncate">{v.originalName}</div>
          <div className="text-[11px] text-gray-500 flex gap-3">
            <span>{fmtDate(v.createdAt)}</span>
            <span>{fmt(v.fileSize)}</span>
            <span>by {v.uploadedBy?.name || '—'}</span>
          </div>
          {v.notes && (
            <div className="text-xs text-gray-400 italic bg-white/[0.03] rounded-md px-2.5 py-1.5 mt-0.5 border-l-2 border-gold/40">
              "{v.notes}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
