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

  if (!part) return <p className="text-gray-500 text-sm py-4">Loading...</p>;

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm">
        <Link to="/products" className="text-gray-500 hover:text-gray-300 transition-colors">Products</Link>
        <span className="text-gray-600">›</span>
        <Link to={`/products/${part.product?._id}`} className="text-gray-500 hover:text-gray-300 transition-colors">{part.product?.name || 'Product'}</Link>
        <span className="text-gray-600">›</span>
        <span className="text-gray-200">{part.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">{part.name}</h1>
          {part.description && <p className="text-sm text-gray-500 mt-1">{part.description}</p>}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 border-b border-white/[0.06] pb-0">
        {[
          { key: 'gcode', label: `G-Code / 3MF (${gcodeVersions.length})` },
          { key: 'stl',   label: `STL Files (${stlVersions.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-normal transition-all duration-150 rounded-none border-b-2 -mb-px
              ${tab === t.key
                ? 'border-gold text-gray-100 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
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
