import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const PartDetail = lazy(() => import('./pages/PartDetail'));
const Printers = lazy(() => import('./pages/Printers'));
const PrintLogs = lazy(() => import('./pages/PrintLogs'));
const Inventory = lazy(() => import('./pages/Inventory'));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function PageLoader() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: 14
    }}>
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Navigate to="/products" />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:productId" element={<ProductDetail />} />
              <Route path="parts/:partId" element={<PartDetail />} />
              <Route path="printers" element={<Printers />} />
              <Route path="printlogs" element={<PrintLogs />} />
              <Route path="inventory" element={<Inventory />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
