import React, { useState, useEffect } from 'react';
import { getStoredClientEmail, getAccessToken, apiFetch } from '../../../lib/api/client';
import { logoutApi, getProfileApi, type UserProfile } from '../../auth/api/auth.api';

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalFormatted: string;
  createdAt: string;
  shippingName: string;
  shippingCity: string;
  shippingState: string;
}

export const AccountExperience: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fontStyle = {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  useEffect(() => {
    const storedEmail = getStoredClientEmail();
    const token = getAccessToken();

    if (storedEmail) {
      setEmail(storedEmail);
    }

    // Load saved addresses from localStorage
    try {
      const saved = localStorage.getItem('dd_saved_addresses');
      if (saved) {
        setSavedAddresses(JSON.parse(saved));
      }
    } catch {}

    // Load user profile & orders if authenticated
    if (token || storedEmail) {
      getProfileApi().then((res) => {
        if (res.success && res.data) {
          setProfile(res.data);
          if (res.data.email) setEmail(res.data.email);
        }
      });

      apiFetch<{ orders: any[]; total: number }>('/api/orders').then((res) => {
        setIsLoading(false);
        if (res.success && res.data?.orders) {
          const mapped = res.data.orders.map((o) => ({
            id: o.id,
            orderNumber: o.order_number,
            status: o.status,
            paymentStatus: o.payment_status,
            totalFormatted: `₹ ${(o.total_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`,
            createdAt: new Date(o.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }),
            shippingName: o.shipping_name,
            shippingCity: o.shipping_city,
            shippingState: o.shipping_state,
          }));
          setOrders(mapped);
        } else {
          // Fallback to last placed order if API is offline
          const lastOrder = localStorage.getItem('dd_last_order');
          if (lastOrder) {
            setOrders([
              {
                id: 'last_order',
                orderNumber: lastOrder,
                status: 'confirmed',
                paymentStatus: 'paid',
                totalFormatted: 'Confirmed',
                createdAt: 'Recent',
                shippingName: 'Client Commission',
                shippingCity: 'India',
                shippingState: '',
              }
            ]);
          }
        }
      }).catch(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    window.location.href = '/';
  };

  // If not authenticated, prompt to sign in
  if (!email && !isLoading) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 sm:px-6 text-center" style={fontStyle}>
        <div className="w-16 h-16 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="7" r="4" />
            <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
          </svg>
        </div>
        <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
          Private Client Identification
        </span>
        <h1 className="text-3xl font-light text-neutral-900 font-serif mb-4">
          Client Portal Access
        </h1>
        <p className="text-sm text-neutral-600 font-light mb-8 max-w-md mx-auto leading-relaxed">
          Sign in to review your sartorial commissions, track white-glove deliveries, and manage your private address book.
        </p>
        <a
          href="/account/sign-in"
          className="inline-block px-10 py-4 bg-neutral-900 text-white uppercase text-xs tracking-widest font-medium hover:bg-black transition-all"
        >
          Sign In with Email OTP
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8" style={fontStyle}>
      {/* ─── CLIENT HEADER ─── */}
      <div className="bg-neutral-50/70 border border-neutral-200/80 p-6 sm:p-8 rounded-xl mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-400 font-mono block mb-1">
            Private Client
          </span>
          <h1 className="text-2xl sm:text-3xl font-light text-neutral-900 font-serif">
            {profile?.fullName || 'Private Client'}
          </h1>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            {email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/orders/track"
            className="px-5 py-2.5 bg-white border border-neutral-300 hover:border-black text-neutral-900 text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Track Shipment
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─── LEFT: RECENT COMMISSIONS (2 Cols) ─── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <h2 className="text-lg font-medium text-neutral-900">
              Sartorial Commissions ({orders.length})
            </h2>
            <a href="/orders/track" className="text-xs text-neutral-500 hover:text-black uppercase tracking-wider underline">
              Track Any Order
            </a>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-neutral-200/80 p-8 text-center rounded-lg">
              <p className="text-sm text-neutral-500 mb-4">No commissions placed under this account yet.</p>
              <a
                href="/categories"
                className="inline-block px-6 py-2.5 bg-neutral-900 text-white text-xs uppercase tracking-widest"
              >
                Explore Collection
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-neutral-200/90 rounded-xl p-5 sm:p-6 shadow-sm hover:border-neutral-400 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {order.orderNumber}
                      </span>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] uppercase tracking-wider font-mono rounded">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Commissioned on {order.createdAt} &bull; Destination: {order.shippingCity}, {order.shippingState}
                    </p>
                    <p className="text-xs font-semibold text-neutral-800">
                      Total: {order.totalFormatted}
                    </p>
                  </div>

                  <a
                    href={`/orders/track?order=${encodeURIComponent(order.orderNumber)}`}
                    className="w-full sm:w-auto px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium rounded transition-colors text-center shrink-0 flex items-center justify-center gap-2"
                  >
                    <span>Track Live</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── RIGHT: ADDRESSES & CONCIERGE (1 Col) ─── */}
        <div className="space-y-6">
          <div className="pb-3 border-b border-neutral-200">
            <h2 className="text-lg font-medium text-neutral-900">
              Delivery Address Book
            </h2>
          </div>

          {savedAddresses.length === 0 ? (
            <div className="bg-white border border-neutral-200/80 p-6 rounded-lg text-center">
              <p className="text-xs text-neutral-500">Your address book will automatically save during checkout.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedAddresses.map((addr) => (
                <div key={addr.id} className="bg-white border border-neutral-200/90 rounded-lg p-4 text-xs space-y-1">
                  <p className="font-semibold text-neutral-900">{addr.fullName}</p>
                  <p className="text-neutral-600">{addr.address} {addr.apartment || ''}</p>
                  <p className="text-neutral-600">{addr.city}, {addr.province} {addr.postalCode}</p>
                  <p className="text-neutral-500 font-mono">{addr.phone}</p>
                </div>
              ))}
            </div>
          )}

          {/* Concierge Assistance Card */}
          <div className="bg-neutral-50 border border-neutral-200/80 p-6 rounded-xl space-y-3">
            <span className="text-[10px] uppercase tracking-widest font-mono text-neutral-400 block">
              Sartorial Concierge
            </span>
            <h3 className="text-sm font-medium text-neutral-900">
              Need assistance with your commission?
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-light">
              Our master tailors and private client advisers are available for bespoke alteration consultations and dispatch updates.
            </p>
            <a
              href="/contact"
              className="inline-block text-xs uppercase tracking-wider font-semibold text-neutral-900 underline underline-offset-4"
            >
              Contact Client Concierge &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
