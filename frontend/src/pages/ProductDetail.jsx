import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProduct, getParts, createPart, updatePart, deletePart } from '../api';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProductDetail() {
  const { productId } = useParams();
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission('products');
  const { confirmModal, ask } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editPart, setEditPart] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

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

  const updateMutation = useMutation({
    mutationFn: updatePart,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts', productId] });
      setEditPart(null);
    },
    onError: (err) => alert(err.response?.data?.message || 'Update failed'),
  });

  const openEdit = (p) => {
    setEditPart(p);
    setEditForm({ name: p.name, description: p.description || '' });
  };

  const submitEdit = (e) => {
    e.preventDefault();
    updateMutation.mutate({ id: editPart._id, data: editForm });
  };

  const remove = async (id) => {
    const ok = await ask({ title: 'Delete part?', message: 'This will permanently delete this part and all its versions.' });
    if (ok) deleteMutation.mutate(id);
  };

  if (productLoading || partsLoading) return <PageLoading />;

  return (
    <>{confirmModal}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
        {parts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p className="text-sm">No parts yet. Add the first part for this product.</p>
          </div>
        ) : parts.map((p) => (
          <div key={p._id} className="bg-surface rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            {/* Thumbnail from latest 3mf */}
            <div className="w-full h-32 overflow-hidden bg-surface-3 flex items-center justify-center">
              {p.thumbnailUrl
                ? <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-surface-2" />
              }
            </div>
            <div className="p-3.5 flex flex-col gap-1.5 flex-1">
              {/* Name */}
              <span className="text-sm font-semibold text-gray-800 leading-tight">{p.name}</span>
              {/* Description */}
              {p.description && (
                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{p.description}</p>
              )}
              {/* Updated date */}
              <p className="text-[10px] text-gray-400 mt-0.5">Updated {fmtDate(p.updatedAt)}</p>
              {/* Actions */}
              <div className="flex gap-1.5 mt-auto pt-2">
                <Link to={`/parts/${p._id}`} className="flex-1">
                  <button className="w-full text-xs font-medium px-2.5 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-500 transition-all">G-Code →</button>
                </Link>
                {canWrite && (
                  <button
                    className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 transition-all"
                    title="Edit"
                    onClick={() => openEdit(p)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                {canDelete && (
                  <button
                    className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-all"
                    onClick={() => remove(p._id)}
                  ><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">New Part</h2>
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
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Part Modal */}
      {editPart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditPart(null)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Edit Part</h2>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Part Name</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                <textarea rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setEditPart(null)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
