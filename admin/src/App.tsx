import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import { Spinner } from './components/ui';

// Auth
import SignInPage from './modules/auth/SignInPage';

// Lazy-loaded modules
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage'));
const BrandPage = lazy(() => import('./modules/brand/BrandPage'));
const StudioPage = lazy(() => import('./modules/studio/StudioPage'));
const PageEditor = lazy(() => import('./modules/studio/PageEditor'));
const NavigationPage = lazy(() => import('./modules/navigation/NavigationPage'));
const MediaLibraryPage = lazy(() => import('./modules/media/MediaLibraryPage'));
const ProductsListPage = lazy(() => import('./modules/catalog/ProductsListPage'));
const ProductEditor = lazy(() => import('./modules/catalog/ProductEditor'));
const CategoriesPage = lazy(() => import('./modules/catalog/CategoriesPage'));
const CollectionsPage = lazy(() => import('./modules/catalog/CollectionsPage'));
const SizeGuidesPage = lazy(() => import('./modules/catalog/SizeGuidesPage'));
const InventoryPage = lazy(() => import('./modules/inventory/InventoryPage'));
const OrdersListPage = lazy(() => import('./modules/orders/OrdersListPage'));
const OrderDetailPage = lazy(() => import('./modules/orders/OrderDetailPage'));
const CustomersListPage = lazy(() => import('./modules/customers/CustomersListPage'));
const CustomerDetailPage = lazy(() => import('./modules/customers/CustomerDetailPage'));
const ReturnsPage = lazy(() => import('./modules/returns/ReturnsPage'));
const DisputesPage = lazy(() => import('./modules/disputes/DisputesPage'));
const CouponsPage = lazy(() => import('./modules/promotions/CouponsPage'));
const ReviewsPage = lazy(() => import('./modules/reviews/ReviewsPage'));
const InquiriesPage = lazy(() => import('./modules/concierge/InquiriesPage'));
const AnalyticsPage = lazy(() => import('./modules/analytics/AnalyticsPage'));
const TemplatesPage = lazy(() => import('./modules/messaging/TemplatesPage'));
const SeoPage = lazy(() => import('./modules/seo/SeoPage'));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'));
const SecurityPage = lazy(() => import('./modules/security/SecurityPage'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
    </div>
  );
}

function ProtectedApp() {
  const { user, loading, mfaRequired } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
  if (!user || mfaRequired) return <Navigate to="/sign-in" replace />;

  return (
    <AdminLayout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="brand" element={<BrandPage />} />
          <Route path="studio" element={<StudioPage />} />
          <Route path="studio/:pageId" element={<PageEditor />} />
          <Route path="navigation" element={<NavigationPage />} />
          <Route path="media" element={<MediaLibraryPage />} />
          <Route path="catalog/products" element={<ProductsListPage />} />
          <Route path="catalog/products/new" element={<ProductEditor />} />
          <Route path="catalog/products/:id" element={<ProductEditor />} />
          <Route path="catalog/categories" element={<CategoriesPage />} />
          <Route path="catalog/collections" element={<CollectionsPage />} />
          <Route path="catalog/size-guides" element={<SizeGuidesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="orders" element={<OrdersListPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="customers" element={<CustomersListPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="disputes" element={<DisputesPage />} />
          <Route path="promotions/coupons" element={<CouponsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="concierge" element={<InquiriesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="messaging/templates" element={<TemplatesPage />} />
          <Route path="seo" element={<SeoPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
