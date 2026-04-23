import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, getParts, createPart, deletePart } from '../api';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';

export default function ProductDetail() {
  const { productId } = useParams();
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
  });

  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ['parts', productId],
    queryFn: () => getParts(productId),
  });

  const createMutation = useMutation({
    mutationFn: createPart,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts', productId] });
      setForm({ name: '', description: '' });
      setShowModal(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Create failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePart,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parts', productId] }),
    onError: () => alert('Delete failed'),
  });

  const create = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...form, product: productId });
  };

  const remove = (id) => {
    if (!confirm('Delete this part?')) return;
    deleteMutation.mutate(id);
  };

  if (productLoading || partsLoading) return <PageLoading />;

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm animate-fade-in">
        <Link to="/products" className="text-gray-500 hover:text-gray-300 transition-colors">Products</Link>
        <span className="text-gray-600">›</span>
        <span className="text-gray-200">{product.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">{product.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {product.sku && (
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gold/15 text-gold mr-2">
                SKU: {product.sku}
              </span>
            )}
            {parts.length} part{parts.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <button
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all shadow-lg shadow-brand-500/20"
            onClick={() => setShowModal(true)}
          >
            + Add Part
          </button>
        )}
      </div>

      {product.description && (
        <p className="text-sm text-gray-400 mb-6">{product.description}</p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
        {parts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p className="text-sm">No parts yet. Add the first part for this product.</p>
          </div>
        ) : parts.map((p, i) => (
          <div key={p._id} className="glass rounded-xl p-5 flex flex-col gap-3 hover:bg-white/[0.06] transition-all duration-200">
            <span className="text-3xl font-extrabold text-white/[0.06] leading-none tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Part</div>
              <div className="text-base font-semibold text-gray-200">{p.name}</div>
            </div>
            {p.description && (
              <p className="text-sm text-gray-400 leading-relaxed">{p.description}</p>
            )}
            <div className="flex gap-2 mt-1">
              <Link to={`/parts/${p._id}`}>
                <button className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500/80 text-gray-200 hover:bg-brand-500 transition-all">G-Code Versions →</button>
              </Link>
              {canDelete && (
                <button
                  className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                  onClick={() => remove(p._id)}
                >Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="glass-strong rounded-2xl p-7 w-[460px] max-w-[95vw] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-5">New Part</h2>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Part Name</label>
                <input placeholder="e.g. Base Plate" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                <textarea rows={3} placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] text-sm transition-all" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
