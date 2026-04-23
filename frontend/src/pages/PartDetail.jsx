import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPart, getGcodes, getStlVersions } from '../api';
import GCodeTab from '../components/GCodeTab';
import StlTab from '../components/StlTab';

export default function PartDetail() {
  const { partId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'gcode';

  const { data: part } = useQuery({
    queryKey: ['part', partId],
    queryFn: () => getPart(partId),
  });

  // Prefetch version counts for tab labels (same queryKey as child tabs → zero extra requests)
  const { data: gcodeVersions = [] } = useQuery({
    queryKey: ['gcodes', partId],
    queryFn: () => getGcodes(partId),
  });
  const { data: stlVersions = [] } = useQuery({
    queryKey: ['stl', partId],
    queryFn: () => getStlVersions(partId),
  });

  const setTab = (newTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };

  if (!part) return <p style={{ color: 'var(--text-muted-dark)' }}>Loading...</p>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/products">Products</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to={`/products/${part.product?._id}`}>{part.product?.name || 'Product'}</Link>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-on-dark)' }}>{part.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1>{part.name}</h1>
          {part.description && <p className="page-subtitle">{part.description}</p>}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-dark)', paddingBottom: 0 }}>
        {[
          { key: 'gcode', label: `G-Code / 3MF (${gcodeVersions.length})` },
          { key: 'stl',   label: `STL Files (${stlVersions.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-on-dark)' : 'var(--text-muted-dark)',
              padding: '8px 16px', fontWeight: tab === t.key ? 700 : 400,
              fontSize: 14, cursor: 'pointer', borderRadius: 0, marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Each tab owns its state + URL memory (gv / sv search params) */}
      {tab === 'gcode' && <GCodeTab partId={partId} partName={part.name} />}
      {tab === 'stl'   && <StlTab  partId={partId} partName={part.name} />}
    </>
  );
}
