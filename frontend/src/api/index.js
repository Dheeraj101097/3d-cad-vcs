import axios from 'axios';

// ── Products ──────────────────────────────────────────────────────────
export const getProducts   = () => axios.get('/api/products').then(r => r.data);
export const createProduct = (data) => axios.post('/api/products', data).then(r => r.data);
export const updateProduct = ({ id, data }) => axios.put(`/api/products/${id}`, data).then(r => r.data);
export const deleteProduct = (id)   => axios.delete(`/api/products/${id}`).then(r => r.data);

// ── Parts ─────────────────────────────────────────────────────────────
export const getProduct = (id)          => axios.get(`/api/products/${id}`).then(r => r.data);
export const getParts   = (productId)   => axios.get(`/api/parts/product/${productId}`).then(r => r.data);
export const getPart    = (id)          => axios.get(`/api/parts/${id}`).then(r => r.data);
export const createPart = (data)        => axios.post('/api/parts', data).then(r => r.data);
export const updatePart = ({ id, data }) => axios.put(`/api/parts/${id}`, data).then(r => r.data);
export const deletePart = (id)          => axios.delete(`/api/parts/${id}`).then(r => r.data);

// ── G-Code Versions ───────────────────────────────────────────────────
export const getGcodes       = (partId) => axios.get(`/api/gcodes/part/${partId}`).then(r => r.data);
export const getGcodeContent = (id)     => axios.get(`/api/gcodes/${id}/content`, { responseType: 'text' }).then(r => r.data);
export const uploadGcode     = (partId, fd) => axios.post(`/api/gcodes/part/${partId}`, fd).then(r => r.data);
export const deleteGcode     = (id)     => axios.delete(`/api/gcodes/${id}`).then(r => r.data);

// ── STL Versions ──────────────────────────────────────────────────────
export const getStlVersions = (partId) => axios.get(`/api/stl/part/${partId}`).then(r => r.data);
export const uploadStl      = (partId, fd) => axios.post(`/api/stl/part/${partId}`, fd).then(r => r.data);
export const deleteStl      = (id)     => axios.delete(`/api/stl/${id}`).then(r => r.data);

// ── Printers ──────────────────────────────────────────────────────────
export const getPrinters      = ()           => axios.get('/api/printers').then(r => r.data);
export const createPrinter    = (data)       => axios.post('/api/printers', data).then(r => r.data);
export const updatePrinter    = ({ id, data }) => axios.put(`/api/printers/${id}`, data).then(r => r.data);
export const deletePrinter    = (id)         => axios.delete(`/api/printers/${id}`).then(r => r.data);
export const getPrinterStatus = (id)         => axios.get(`/api/printers/${id}/status`).then(r => r.data);
export const getPrinterSdCard = (id)         => axios.get(`/api/printers/${id}/sdcard`).then(r => r.data);
export const deleteSdFile     = ({ printerId, filename }) =>
  axios.delete(`/api/printers/${printerId}/sdcard/${encodeURIComponent(filename)}`).then(r => r.data);
export const getPrintOptions  = ()           => axios.get('/api/gcodes/print-options').then(r => r.data);
export const uploadToPrinter  = ({ printerId, versionId }) =>
  axios.post(`/api/printers/${printerId}/upload/${versionId}`).then(r => r.data);
export const startPrint = ({ printerId, ...data }) =>
  axios.post(`/api/printers/${printerId}/startprint`, data).then(r => r.data);

// ── Print Logs ────────────────────────────────────────────────────────
export const getPrintLogs  = (filter) =>
  axios.get('/api/printlogs', { params: filter ? { status: filter } : {} }).then(r => r.data);
export const getPrintStats = () => axios.get('/api/printlogs/stats').then(r => r.data);

// ── Inventory ─────────────────────────────────────────────────────────
export const getInventoryGroups    = ()           => axios.get('/api/inventory/groups').then(r => r.data);
export const createInventoryGroup  = (data)       => axios.post('/api/inventory/groups', data).then(r => r.data);
export const updateInventoryGroup  = ({ id, data }) => axios.put(`/api/inventory/groups/${id}`, data).then(r => r.data);
export const deleteInventoryGroup  = (id)         => axios.delete(`/api/inventory/groups/${id}`).then(r => r.data);

export const getInventoryComponents   = (params) => axios.get('/api/inventory/components', { params }).then(r => r.data);
export const createInventoryComponent = (data)   => axios.post('/api/inventory/components', data).then(r => r.data);
export const updateInventoryComponent = ({ id, data }) => axios.put(`/api/inventory/components/${id}`, data).then(r => r.data);
export const deleteInventoryComponent = (id)     => axios.delete(`/api/inventory/components/${id}`).then(r => r.data);
export const adjustInventoryStock     = ({ id, field, delta }) =>
  axios.post(`/api/inventory/components/${id}/adjust`, { field, delta }).then(r => r.data);
export const acknowledgeAlert         = (id)     => axios.post(`/api/inventory/components/${id}/acknowledge`).then(r => r.data);

export const getInventoryAlerts  = ()     => axios.get('/api/inventory/alerts').then(r => r.data);
export const getInventoryTypes   = ()     => axios.get('/api/inventory/types').then(r => r.data);
export const createInventoryType = (data) => axios.post('/api/inventory/types', data).then(r => r.data);
export const deleteInventoryType = (id)   => axios.delete(`/api/inventory/types/${id}`).then(r => r.data);
export const seedInventoryTypes  = ()     => axios.post('/api/inventory/types/seed').then(r => r.data);

// ── Admin ─────────────────────────────────────────────────────────────
export const updateUserPermissions = ({ id, resource, bits }) =>
  axios.patch(`/api/admin/users/${id}/permissions`, { resource, bits }).then(r => r.data);

// ── Download utility (uses fetch so browser triggers save dialog) ─────
export const downloadVersion = async (v, type = 'gcode') => {
  const token = localStorage.getItem('cad_token');
  const url = type === 'stl' ? `/api/stl/${v._id}/download` : `/api/gcodes/${v._id}/download`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = v.originalName;
  a.click();
  URL.revokeObjectURL(a.href);
};
