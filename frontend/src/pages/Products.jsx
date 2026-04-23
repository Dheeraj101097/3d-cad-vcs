import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, createProduct, deleteProduct } from '../api';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';

export default function Products() {
  const qc = useQueryClient();
  const { canRead, canWrite, canDelete } = usePermission('products');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', sku: '', imageFile: null });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setForm({ name: '', description: '', sku: '', imageFile: null });
      setShowModal(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Create failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: () => alert('Delete failed'),
  });

  const create = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', form.name);
    if (form.sku) fd.append('sku', form.sku);
    if (form.description) fd.append('description', form.description);
    if (form.imageFile) fd.append('image', form.imageFile);
    createMutation.mutate(fd);
  };

  const remove = (id) => {
    if (!confirm('Delete this product and all its parts?')) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) return <PageLoading />;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">Products</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} product{products.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        {canWrite && (
          <button
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all shadow-lg shadow-brand-500/20"
            onClick={() => setShowModal(true)}
          >
            + New Product
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
        {products.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p className="text-sm">No products yet. Create your first one to get started.</p>
          </div>
        ) : products.map((p) => (
          <div key={p._id} className="glass rounded-xl p-5 flex flex-col gap-3 hover:bg-white/[0.06] transition-all duration-200 group">
            {/* Image placeholder */}
            <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-brand-900/60 flex items-center justify-center mb-1">
              {p.imageUrl
                ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-brand-900/80" />
              }
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Product</div>
              <div className="text-base font-semibold text-gray-200">{p.name}</div>
            </div>
            {p.sku && (
              <span className="inline-block self-start text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gold/15 text-gold">
                SKU: {p.sku}
              </span>
            )}
            {p.description && (
              <p className="text-sm text-gray-400 leading-relaxed">{p.description}</p>
            )}
            <div className="flex gap-2 mt-1">
              <Link to={`/products/${p._id}`}>
                <button className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500/80 text-gray-200 hover:bg-brand-500 transition-all">View Parts →</button>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowModal(false); setForm({ name: '', description: '', sku: '', imageFile: null }); }}>
          <div className="glass-strong rounded-2xl p-7 w-[460px] max-w-[95vw] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-5">New Product</h2>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Product Name</label>
                <input placeholder="e.g. Phone Stand" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">SKU</label>
                <input placeholder="e.g. PS-001" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                <textarea rows={3} placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Product Image <span className="normal-case text-gray-600">(optional · jpg/png)</span></label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={e => setForm({ ...form, imageFile: e.target.files[0] || null })}
                  className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white/[0.06] file:text-gray-300 hover:file:bg-white/[0.10] cursor-pointer"
                  style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '4px 0' }}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] text-sm transition-all" onClick={() => { setShowModal(false); setForm({ name: '', description: '', sku: '', imageFile: null }); }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
