import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Login           = lazy(() => import('./pages/Login'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Products        = lazy(() => import('./pages/Products'));
const ProductDetail   = lazy(() => import('./pages/ProductDetail'));
const PartDetail      = lazy(() => import('./pages/PartDetail'));
const Printers        = lazy(() => import('./pages/Printers'));
const PrintLogs       = lazy(() => import('./pages/PrintLogs'));
const Inventory       = lazy(() => import('./pages/Inventory'));
const AdminPanel      = lazy(() => import('./pages/AdminPanel'));
const NoAccess        = lazy(() => import('./pages/NoAccess'));

// Must be logged in; pending/revoked users are redirected to /pending
function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'pending' || user.role === 'revoked') return <Navigate to="/pending" replace />;
  return children;
}

// Must be logged in (any role — used for the pending page itself)
function LoggedInOnly({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Active users shouldn't sit on /pending
  if (user.role !== 'pending' && user.role !== 'revoked') return <Navigate to="/products" replace />;
  return children;
}

// Must be admin
function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/products" replace />;
  return children;
}

// Per-resource route protection — redirects to /no-access if user lacks read bit
function ResourceRoute({ resource, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return children;
  const bits = user?.permissions?.[resource] ?? 0;
  if (!(bits & 4)) return <Navigate to="/no-access" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pending" element={<LoggedInOnly><PendingApproval /></LoggedInOnly>} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/products" replace />} />
              <Route path="products"            element={<ResourceRoute resource="products"><Products /></ResourceRoute>} />
              <Route path="products/:productId" element={<ResourceRoute resource="products"><ProductDetail /></ResourceRoute>} />
              <Route path="parts/:partId"       element={<ResourceRoute resource="products"><PartDetail /></ResourceRoute>} />
              <Route path="printers"            element={<ResourceRoute resource="printers"><Printers /></ResourceRoute>} />
              <Route path="printlogs"           element={<ResourceRoute resource="print_logs"><PrintLogs /></ResourceRoute>} />
              <Route path="inventory"           element={<ResourceRoute resource="inventory"><Inventory /></ResourceRoute>} />
              <Route path="admin"               element={<AdminOnly><AdminPanel /></AdminOnly>} />
              <Route path="no-access"           element={<NoAccess />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
