import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, createProduct, deleteProduct } from '../api';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';

export default function Products() {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', sku: '' });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setForm({ name: '', description: '', sku: '' });
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
    createMutation.mutate(form);
  };

  const remove = (id) => {
    if (!confirm('Delete this product and all its parts?')) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) return <PageLoading />;

  return (
    <>
      <div className="page-header page-fade">
        <div>
          <h1>Products</h1>
          <p className="page-subtitle">{products.length} product{products.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        {canWrite && <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Product</button>}
      </div>

      <div className="grid page-fade">
        {products.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state-icon">📦</div>
            <p>No products yet. Create your first one to get started.</p>
          </div>
        ) : products.map((p, i) => (
          <div key={p._id} className="item-card">
            <div className="item-card-number">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <div className="item-card-meta">Product</div>
              <div className="item-card-title">{p.name}</div>
            </div>
            {p.sku && <span className="badge badge-gold">SKU: {p.sku}</span>}
            {p.description && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Link to={`/products/${p._id}`}>
                <button className="btn-primary btn-sm">View Parts →</button>
              </Link>
              {canDelete && <button className="btn-danger btn-sm" onClick={() => remove(p._id)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Product</h2>
            <form onSubmit={create}>
              <div className="form-group">
                <label>Product Name</label>
                <input placeholder="e.g. Phone Stand" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input placeholder="e.g. PS-001" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
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
