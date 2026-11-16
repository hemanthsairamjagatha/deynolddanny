import React, { useState, useEffect } from 'react';
import {
  getStoredClientEmail,
  hasSessionHint,
  ensureAuthenticatedSession,
} from '../../../lib/api/client';
import {
  logoutApi,
  getProfileApi,
  updateProfileApi,
  type UserProfile,
} from '../../auth/api/auth.api';
import {
  fetchMyOrdersApi,
  cancelOrderApi,
  requestReturnApi,
  fetchOrderInvoiceApi,
  type PatronOrderSummary,
} from '../../orders/api/orders.api';
import {
  listAddressesApi,
  createAddressApi,
  deleteAddressApi,
  exportPersonalDataApi,
  deleteAccountApi,
  type PatronAddress,
} from '../api/account.api';

export const AccountExperience: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<PatronOrderSummary[]>([]);
  const [addresses, setAddresses] = useState<PatronAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile editor state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Add address state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrForm, setAddrForm] = useState({
    addressType: 'Home' as 'Home' | 'Office' | 'Other',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [isSavingAddr, setIsSavingAddr] = useState(false);

  // Cancel / Return / Invoice / Erasure state
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnResolution, setReturnResolution] = useState<'refund' | 'exchange'>('refund');
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fontStyle = {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      if (!hasSessionHint()) {
        setProfile(null);
        setEmail(null);
        setIsLoading(false);
        return;
      }

      const token = await ensureAuthenticatedSession();
      if (!token) {
        setProfile(null);
        setEmail(null);
        setIsLoading(false);
        return;
      }

      const [profileRes, ordersRes, addrRes] = await Promise.all([
        getProfileApi(),
        fetchMyOrdersApi(1, 20),
        listAddressesApi(),
      ]);

      if (profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
        setEmail(profileRes.data.email || getStoredClientEmail());
        setEditName(profileRes.data.fullName || '');
        setEditPhone(profileRes.data.phone || '');
      }

      if (ordersRes.success && ordersRes.data?.items) {
        setOrders(ordersRes.data.items);
      }

      if (addrRes.success && addrRes.data?.items) {
        setAddresses(addrRes.data.items);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Unable to load your profile at this moment.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountData();
    const handleCleared = () => {
      setProfile(null);
      setEmail(null);
      setOrders([]);
      setAddresses([]);
    };
    window.addEventListener('dd:session-cleared', handleCleared);
    return () => window.removeEventListener('dd:session-cleared', handleCleared);
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    window.location.href = '/';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSavingProfile(true);
    try {
      const res = await updateProfileApi({
        fullName: editName.trim() || undefined,
        phone: editPhone.trim() || undefined,
      });
      if (res.success && res.data) {
        setProfile(res.data);
        setFeedback({ type: 'success', text: 'Profile updated successfully.' });
      } else {
        setFeedback({ type: 'error', text: res.error?.message || 'Unable to update profile.' });
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSavingAddr(true);
    try {
      const res = await createAddressApi({
        ...addrForm,
        line2: addrForm.line2.trim() || undefined,
        country: 'India',
      });
      if (res.success && res.data) {
        setAddresses((prev) => [res.data!, ...prev]);
        setShowAddressForm(false);
        setAddrForm({
          addressType: 'Home',
          fullName: '',
          phone: '',
          line1: '',
          line2: '',
          city: '',
          state: '',
          pincode: '',
        });
        setFeedback({ type: 'success', text: 'Address saved to your delivery book.' });
      } else {
        setFeedback({ type: 'error', text: res.error?.message || 'Could not save address.' });
      }
    } finally {
      setIsSavingAddr(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const res = await deleteAddressApi(addressId);
    if (res.success) {
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      setFeedback({ type: 'success', text: 'Address removed.' });
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrderId || cancelReason.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Please provide a brief cancellation reason (min 3 characters).' });
      return;
    }
    const res = await cancelOrderApi(cancelOrderId, cancelReason.trim());
    if (res.success) {
      setCancelOrderId(null);
      setCancelReason('');
      setFeedback({
        type: 'success',
        text: 'Order cancellation recorded cleanly. Eligible refunds will reflect to the original payment method.',
      });
      await loadAccountData();
    } else {
      setFeedback({ type: 'error', text: res.error?.message || 'Order cannot be cancelled at this stage.' });
    }
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnOrderId || returnReason.trim().length < 5) {
      setFeedback({ type: 'error', text: 'Please describe the reason for return (min 5 characters).' });
      return;
    }
    const res = await requestReturnApi(returnOrderId, {
      reason: returnReason.trim(),
      resolution: returnResolution,
    });
    if (res.success) {
      setReturnOrderId(null);
      setReturnReason('');
      setFeedback({
        type: 'success',
        text: 'Return request registered. Our concierge will arrange pickup inspection.',
      });
      await loadAccountData();
    } else {
      setFeedback({ type: 'error', text: res.error?.message || 'Return request could not be submitted.' });
    }
  };

  const handleViewInvoice = async (orderId: string) => {
    const res = await fetchOrderInvoiceApi(orderId);
    if (res.success && res.data) {
      setInvoiceData(res.data);
    } else {
      setFeedback({ type: 'error', text: res.error?.message || 'Invoice unavailable for this order.' });
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setFeedback(null);
    try {
      const res = await exportPersonalDataApi();
      if (res.success && res.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `deynold-danny-data-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setFeedback({ type: 'success', text: 'Your personal data export has been downloaded.' });
      } else {
        setFeedback({ type: 'error', text: res.error?.message || 'Unable to export data.' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleEraseAccount = async () => {
    setIsDeleting(true);
    setFeedback(null);
    try {
      const res = await deleteAccountApi();
      if (res.success && res.data?.deleted) {
        window.location.href = '/';
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Account deletion is blocked while orders remain active.',
        });
        setConfirmDeleteStep(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center" style={fontStyle}>
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Loading your client dossier...</p>
      </div>
    );
  }

  if (!email && !profile) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center" style={fontStyle}>
        <div className="bg-white border border-neutral-200/80 p-8 sm:p-12 shadow-sm rounded-sm">
          <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-2">
            Client Dossier
          </span>
          <h1 className="text-2xl sm:text-3xl font-light text-neutral-900 font-serif mb-3">
            Sign In to Your Profile
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed mb-8">
            Access your bespoke wardrobe orders, live shipment tracking, saved addresses, and private client privileges.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/account/sign-in?redirect=/account"
              className="px-8 py-3.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest font-medium rounded-full transition-colors"
            >
              Sign In
            </a>
            <a
              href="/account/sign-up"
              className="px-8 py-3.5 border border-neutral-300 hover:border-black text-neutral-800 text-xs uppercase tracking-widest font-medium rounded-full transition-colors"
            >
              Register Client
            </a>
          </div>
        </div>
      </div>
    );
  }

  const formatMoney = (paise?: number, formatted?: string) => {
    if (formatted) return formatted;
    if (typeof paise === 'number') {
      return `₹ ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`;
    }
    return '₹ 0.00 INR';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16" style={fontStyle}>
      {/* Profile Header */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] font-mono text-neutral-400 block mb-1">
            Private Client Profile
          </span>
          <h1 className="text-2xl sm:text-3xl font-light text-neutral-900 font-serif">
            {profile?.fullName || 'Valued Client'}
          </h1>
          <p className="text-xs text-neutral-500 font-mono mt-1">{email || profile?.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/orders/track"
            className="px-5 py-2.5 border border-neutral-300 text-neutral-800 hover:border-black hover:text-black rounded-lg text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Track Shipment
          </a>
          <a
            href="/wishlist"
            className="px-5 py-2.5 border border-neutral-300 text-neutral-800 hover:border-black hover:text-black rounded-lg text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Wishlist
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-lg text-xs uppercase tracking-widest font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-8 p-4 rounded-lg border text-xs ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Order History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="pb-3 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-neutral-900">
              Commissions &amp; Order History ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-neutral-200/80 p-10 text-center rounded-xl">
              <p className="text-sm font-light text-neutral-500 mb-4 font-serif italic">
                You have not placed any wardrobe orders yet.
              </p>
              <a
                href="/#mastery"
                className="inline-block px-7 py-3 bg-neutral-900 text-white text-xs uppercase tracking-widest rounded-full hover:bg-black transition-colors"
              >
                Explore Tailoring
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const canCancel = ['pending', 'awaiting_capture', 'confirmed', 'processing'].includes(order.status);
                const canReturn = order.status === 'delivered';
                return (
                  <div
                    key={order.id}
                    className="bg-white border border-neutral-200/90 rounded-xl p-5 sm:p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm font-semibold text-neutral-900">
                            {order.orderNumber}
                          </span>
                          <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-800 border border-neutral-200 text-[10px] uppercase tracking-wider font-mono rounded">
                            {order.status.replace(/_/g, ' ')}
                          </span>
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] uppercase tracking-wider font-mono rounded">
                            {order.paymentStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Placed on{' '}
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs font-semibold text-neutral-800">
                          Total: {formatMoney(order.totalPaise, order.totalFormatted)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/orders/track?order=${encodeURIComponent(order.orderNumber)}${email ? `&email=${encodeURIComponent(email)}` : ''}`}
                          className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-[11px] uppercase tracking-widest font-medium rounded transition-colors"
                        >
                          Track Live
                        </a>
                        <button
                          type="button"
                          onClick={() => handleViewInvoice(order.id)}
                          className="px-3.5 py-2 border border-neutral-300 hover:border-black text-neutral-800 text-[11px] uppercase tracking-wider font-medium rounded transition-colors"
                        >
                          Invoice
                        </button>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelOrderId(order.id);
                              setReturnOrderId(null);
                            }}
                            className="px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-[11px] uppercase tracking-wider font-medium rounded transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        {canReturn && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturnOrderId(order.id);
                              setCancelOrderId(null);
                            }}
                            className="px-3.5 py-2 border border-neutral-300 text-neutral-800 hover:border-black text-[11px] uppercase tracking-wider font-medium rounded transition-colors"
                          >
                            Request Return
                          </button>
                        )}
                      </div>
                    </div>

                    {cancelOrderId === order.id && (
                      <form onSubmit={handleConfirmCancel} className="pt-3 border-t border-neutral-100 space-y-2">
                        <label htmlFor={`cancel-reason-${order.id}`} className="block text-[11px] font-mono uppercase text-neutral-600">
                          Cancellation Reason
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id={`cancel-reason-${order.id}`}
                            type="text"
                            required
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Size adjustment / change of plans"
                            className="flex-1 border border-neutral-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-black"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-wider rounded"
                          >
                            Confirm Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelOrderId(null)}
                            className="px-3 py-2 text-xs text-neutral-500 hover:text-black"
                          >
                            Dismiss
                          </button>
                        </div>
                      </form>
                    )}

                    {returnOrderId === order.id && (
                      <form onSubmit={handleConfirmReturn} className="pt-3 border-t border-neutral-100 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            required
                            aria-label="Return reason"
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            placeholder="Describe fit or garment concern..."
                            className="sm:col-span-2 border border-neutral-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-black"
                          />
                          <select
                            aria-label="Return resolution"
                            value={returnResolution}
                            onChange={(e) => setReturnResolution(e.target.value as 'refund' | 'exchange')}
                            className="border border-neutral-300 px-3 py-2 text-xs rounded bg-white"
                          >
                            <option value="refund">Refund to Source</option>
                            <option value="exchange">Size Exchange</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
                          >
                            Submit Return Request
                          </button>
                          <button
                            type="button"
                            onClick={() => setReturnOrderId(null)}
                            className="px-3 py-2 text-xs text-neutral-500 hover:text-black"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Invoice Modal */}
          {invoiceData && (
            <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-neutral-500 block">Tax Invoice Summary</span>
                  <h3 className="text-sm font-semibold text-neutral-900 font-mono">{invoiceData.invoiceNumber}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceData(null)}
                  className="text-xs underline text-neutral-600 hover:text-black"
                >
                  Close Invoice
                </button>
              </div>
              <div className="text-xs text-neutral-700 space-y-1">
                <p><strong>Billed To:</strong> {invoiceData.billingName}</p>
                <p>
                  <strong>Destination:</strong> {invoiceData.shippingAddress?.line1}, {invoiceData.shippingAddress?.city}, {invoiceData.shippingAddress?.state} - {invoiceData.shippingAddress?.pincode}
                </p>
              </div>
              <div className="divide-y divide-neutral-200 text-xs">
                {(invoiceData.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <span>
                      {item.title} &times; {item.quantity} {item.hsnCode ? `(HSN ${item.hsnCode})` : ''}
                    </span>
                    <span className="font-mono">
                      ₹ {((item.totalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-neutral-200 pt-3 text-xs space-y-1">
                <div className="flex justify-between text-neutral-600">
                  <span>GST Included:</span>
                  <span className="font-mono">
                    ₹ {((invoiceData.taxPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-neutral-900">
                  <span>Invoice Total:</span>
                  <span className="font-mono">
                    ₹ {((invoiceData.totalPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Profile Edit, Addresses, Privacy (DPDP) */}
        <div className="space-y-8">
          {/* Profile Settings */}
          <section className="bg-white border border-neutral-200/90 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-900">Profile Details</h2>
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label htmlFor="profile-name" className="block text-[11px] font-mono text-neutral-500 uppercase mb-1">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3 border border-neutral-300 rounded text-xs focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className="block text-[11px] font-mono text-neutral-500 uppercase mb-1">
                  Mobile Number
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full h-10 px-3 border border-neutral-300 rounded text-xs focus:outline-none focus:border-black"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-xs uppercase tracking-widest rounded transition-colors disabled:opacity-50"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </section>

          {/* Delivery Address Book */}
          <section className="space-y-4">
            <div className="pb-2 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="text-base font-medium text-neutral-900">Delivery Address Book</h2>
              <button
                type="button"
                onClick={() => setShowAddressForm((v) => !v)}
                className="text-xs underline text-neutral-700 hover:text-black"
              >
                {showAddressForm ? 'Close' : '+ Add New'}
              </button>
            </div>

            {showAddressForm && (
              <form onSubmit={handleCreateAddress} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-2.5">
                <input
                  type="text"
                  required
                  placeholder="Recipient Full Name"
                  value={addrForm.fullName}
                  onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                  className="w-full h-9 px-3 border border-neutral-300 rounded text-xs"
                />
                <input
                  type="tel"
                  required
                  placeholder="10-digit Mobile"
                  value={addrForm.phone}
                  onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                  className="w-full h-9 px-3 border border-neutral-300 rounded text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="Street Address Line 1"
                  value={addrForm.line1}
                  onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })}
                  className="w-full h-9 px-3 border border-neutral-300 rounded text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="City"
                    value={addrForm.city}
                    onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                    className="h-9 px-3 border border-neutral-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="6-digit Pincode"
                    value={addrForm.pincode}
                    onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })}
                    className="h-9 px-3 border border-neutral-300 rounded text-xs"
                  />
                </div>
                <input
                  type="text"
                  required
                  placeholder="State"
                  value={addrForm.state}
                  onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                  className="w-full h-9 px-3 border border-neutral-300 rounded text-xs"
                />
                <button
                  type="submit"
                  disabled={isSavingAddr}
                  className="w-full py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
                >
                  {isSavingAddr ? 'Saving...' : 'Save Address'}
                </button>
              </form>
            )}

            {addresses.length === 0 ? (
              <div className="bg-white border border-neutral-200/80 p-5 rounded-xl text-center">
                <p className="text-xs text-neutral-500">No saved delivery addresses yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className="bg-white border border-neutral-200/90 rounded-xl p-4 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-neutral-900">{addr.full_name}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-[11px] text-neutral-400 hover:text-red-600 underline"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-neutral-600">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                    </p>
                    <p className="text-neutral-600">
                      {addr.city}, {addr.state} {addr.pincode}
                    </p>
                    <p className="text-neutral-500 font-mono">{addr.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Privacy & DPDP Controls */}
          <section className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500">
              Data Privacy &amp; Governance
            </h2>
            <button
              type="button"
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full py-2.5 border border-neutral-300 bg-white hover:border-black text-neutral-800 text-xs uppercase tracking-wider rounded transition-colors"
            >
              {isExporting ? 'Preparing Archive...' : 'Download Personal Data (JSON)'}
            </button>

            {!confirmDeleteStep ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteStep(true)}
                className="w-full py-2.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs uppercase tracking-wider rounded transition-colors"
              >
                Request Account Erasure
              </button>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded space-y-2 text-xs text-red-800">
                <p>This permanently anonymizes your profile &amp; saved addresses. Active in-flight orders must complete first.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleEraseAccount}
                    className="flex-1 py-2 bg-red-700 text-white rounded text-[11px] uppercase tracking-wider"
                  >
                    {isDeleting ? 'Erasing...' : 'Confirm Erase'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteStep(false)}
                    className="px-3 py-2 border border-neutral-300 bg-white text-neutral-700 rounded text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AccountExperience;
