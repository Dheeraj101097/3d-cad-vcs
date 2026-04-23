export default function VersionList({ title = 'Version History', versions, isLoading, selectedId, onSelect, onDelete, onDownload, fmt, fmtDate, onUpload }) {
  return (
    <div className="version-list">
      <div className="version-list-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{title}{isLoading ? '' : ` (${versions.length})`}</span>
        {onUpload && (
          <button className="btn-primary btn-sm" onClick={onUpload} style={{ fontSize: 11 }}>
            ↑ Upload
          </button>
        )}
      </div>

      {isLoading && (
        <div style={{ padding: '24px 18px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
          <div className="page-loading-spinner" style={{ margin: '0 auto 8px' }} />
          Loading...
        </div>
      )}

      {!isLoading && versions.length === 0 && (
        <div style={{ padding: '24px 18px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
          No versions yet
        </div>
      )}

      {!isLoading && versions.map(v => (
        <div
          key={v._id}
          className={`version-row${selectedId === v._id ? ' active' : ''}`}
          onClick={() => onSelect(v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{v.version}</span>
            {v.isLatest && <span className="badge badge-green">Latest</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onDownload(v); }}>↓</button>
              {onDelete && <button className="btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDelete(v._id); }}>✕</button>}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.originalName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', display: 'flex', gap: 10 }}>
            <span>{fmtDate(v.createdAt)}</span>
            <span>{fmt(v.fileSize)}</span>
            <span>by {v.uploadedBy?.name || '—'}</span>
          </div>
          {v.notes && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface2)', borderRadius: 6, padding: '5px 8px', marginTop: 2 }}>
              "{v.notes}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
