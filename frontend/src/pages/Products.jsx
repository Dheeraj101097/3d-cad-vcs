import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../api';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Products() {
  const qc = useQueryClient();
  const { canRead, canWrite, canDelete } = usePermission('products');
  const { confirmModal, ask } = useConfirm();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', sku: '', imageFile: null });
  const [editProduct, setEditProduct] = useState(null); // product object being edited
  const [editForm, setEditForm] = useState({ name: '', description: '', sku: '', imageFile: null });

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

  const updateMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setEditProduct(null);
    },
    onError: (err) => alert(err.response?.data?.message || 'Update failed'),
  });

  const openEdit = (p) => {
    setEditProduct(p);
    setEditForm({ name: p.name, description: p.description || '', sku: p.sku || '', imageFile: null });
  };

  const submitEdit = (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', editForm.name);
    fd.append('sku', editForm.sku);
    fd.append('description', editForm.description);
    if (editForm.imageFile) fd.append('image', editForm.imageFile);
    updateMutation.mutate({ id: editProduct._id, data: fd });
  };

  const remove = async (id) => {
    const ok = await ask({ title: 'Delete product?', message: 'This will permanently delete the product and all its parts.' });
    if (ok) deleteMutation.mutate(id);
  };

  if (isLoading) return <PageLoading />;

  return (
    <>{confirmModal}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
        {products.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p className="text-sm">No products yet. Create your first one to get started.</p>
          </div>
        ) : products.map((p) => (
          <div key={p._id} className="bg-surface rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            {/* Image */}
            <div className="w-full h-32 overflow-hidden bg-surface-3 flex items-center justify-center">
              {p.imageUrl
                ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-surface-2" />
              }
            </div>
            <div className="p-3.5 flex flex-col gap-1.5 flex-1">
              {/* Name + SKU inline */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800 leading-tight">{p.name}</span>
                {p.sku && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-500 flex-shrink-0">
                    {p.sku}
                  </span>
                )}
              </div>
              {/* Description */}
              {p.description && (
                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{p.description}</p>
              )}
              {/* Updated date */}
              <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(p.updatedAt)}</p>
              {/* Actions */}
              <div className="flex gap-1.5 mt-auto pt-2">
                <Link to={`/products/${p._id}`} className="flex-1">
                  <button className="w-full text-xs font-medium px-2.5 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-500 transition-all">View Parts →</button>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setShowModal(false); setForm({ name: '', description: '', sku: '', imageFile: null }); }}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">New Product</h2>
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
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => { setShowModal(false); setForm({ name: '', description: '', sku: '', imageFile: null }); }}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditProduct(null)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Edit Product</h2>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Product Name</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">SKU</label>
                <input placeholder="e.g. PS-001" value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                <textarea rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
                  Replace Image <span className="normal-case text-gray-600">(optional · leave blank to keep current)</span>
                </label>
                {editProduct.imageUrl && !editForm.imageFile && (
                  <img src={editProduct.imageUrl} alt="" className="w-16 h-12 object-cover rounded mb-2 opacity-60" />
                )}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={e => setEditForm({ ...editForm, imageFile: e.target.files[0] || null })}
                  className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-white/[0.06] file:text-gray-300 hover:file:bg-white/[0.10] cursor-pointer"
                  style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '4px 0' }}
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setEditProduct(null)}>Cancel</button>
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
