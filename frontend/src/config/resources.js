// Central registry — add new items here and they auto-appear in sidebar + admin panel
export const RESOURCES = [
  { key: 'products',   label: 'Products',   path: '/products' },
  { key: 'printers',   label: 'Printers',   path: '/printers' },
  { key: 'print_logs', label: 'Print Logs', path: '/printlogs' },
  { key: 'inventory',  label: 'Inventory',  path: '/inventory' },
];

export const bitsToString = (b) => [b & 4 ? 'r' : '-', b & 2 ? 'w' : '-', b & 1 ? 'd' : '-'].join('');

export const bitsBadgeClass = (bits) => {
  if (bits === 7) return 'bg-green-500/10 text-green-400';
  if (bits >= 4)  return 'bg-yellow-500/10 text-yellow-400';
  if (bits > 0)   return 'bg-orange-500/10 text-orange-400';
  return 'bg-white/[0.05] text-gray-500';
};
