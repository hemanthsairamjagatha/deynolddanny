import React, { useState, useEffect } from 'react';
import { trackOrderApi, type OrderTrackingDetails } from '../api/orders.api';

interface OrderTrackingExperienceProps {
  initialOrderNumber?: string;
}

export const OrderTrackingExperience: React.FC<OrderTrackingExperienceProps> = ({
  initialOrderNumber = '',
}) => {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderTrackingDetails | null>(null);
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [recentOrderNumber, setRecentOrderNumber] = useState<string | null>(null);

  // Read URL query parameter or localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlOrder = params.get('order') || params.get('orderNumber') || params.get('id');
      const storedLast = localStorage.getItem('dd_last_order');

      if (storedLast) {
        setRecentOrderNumber(storedLast);
      }

      if (urlOrder) {
        setOrderNumber(urlOrder);
        performLookup(urlOrder);
      } else if (storedLast && !initialOrderNumber) {
        setOrderNumber(storedLast);
      }
    }
  }, [initialOrderNumber]);

  const performLookup = async (targetOrderNumber: string, verificationQuery?: string) => {
    const cleanNum = targetOrderNumber.trim();
    if (!cleanNum) {
      setError('Please enter your DEYNOLD DANNY order reference.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await trackOrderApi(cleanNum, verificationQuery);
      if (res.success && res.data) {
        setOrderDetails(res.data);
        if (typeof window !== 'undefined') {
          // Update URL without reloading
          const newUrl = `${window.location.pathname}?order=${encodeURIComponent(cleanNum)}`;
          window.history.replaceState({ path: newUrl }, '', newUrl);
          localStorage.setItem('dd_last_order', cleanNum);
        }
      } else {
        setOrderDetails(null);
        setError(res.error?.message || `Could not find an order matching "${cleanNum}".`);
      }
    } catch (err: any) {
      setOrderDetails(null);
      setError(err.message || 'Unable to connect to order tracking service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(orderNumber, emailOrPhone);
  };

  const handleCopyAwb = (awb: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(awb);
      setCopiedAwb(true);
      setTimeout(() => setCopiedAwb(false), 2000);
    }
  };

  const fontStyle = { fontFamily: "'Montserrat', sans-serif" };

  return (
    <div className="w-full font-montserrat text-neutral-900 pb-20" style={fontStyle}>
      {/* ─── TRACKING SEARCH HEADER ─── */}
      <section className="bg-neutral-50/70 border-b border-neutral-200/80 py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-400 block mb-2 font-mono">
              Concierge Logistics & Dispatch
            </span>
            <h1 className="text-3xl sm:text-4xl font-light text-neutral-900 font-serif tracking-tight mb-3">
              Track Your Commission
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 font-light leading-relaxed">
              Monitor the artisanal tailoring, precision quality inspection, and express insured delivery of your
              bespoke order.
            </p>
          </div>

          {/* Search Box Form */}
          <form
            onSubmit={handleFormSubmit}
            className="bg-white border border-neutral-200/90 shadow-sm p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-stretch"
          >
            <div className="relative flex-1">
              <label htmlFor="order-number-input" className="sr-only">
                Order Reference
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" />
                </svg>
              </div>
              <input
                id="order-number-input"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Order Reference (e.g. DD-2026-000004)"
                className="w-full h-12 pl-10 pr-4 text-xs sm:text-sm font-mono uppercase bg-transparent border border-neutral-200 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black placeholder:normal-case placeholder:font-sans placeholder:text-neutral-400 transition-colors"
                required
              />
            </div>

            <div className="relative sm:w-64">
              <label htmlFor="verify-input" className="sr-only">
                Billing Email or Mobile (Optional)
              </label>
              <input
                id="verify-input"
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="Email or Mobile (Optional)"
                className="w-full h-12 px-3 text-xs sm:text-sm bg-transparent border border-neutral-200 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black placeholder:text-neutral-400 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !orderNumber.trim()}
              className="h-12 px-8 bg-neutral-900 hover:bg-black text-white rounded-lg text-xs uppercase tracking-widest font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Locating...</span>
                </>
              ) : (
                <span>Track Order</span>
              )}
            </button>
          </form>

          {/* Quick chip for last completed order */}
          {recentOrderNumber && recentOrderNumber !== orderNumber && !orderDetails && (
            <div className="mt-3 text-center sm:text-left flex items-center justify-center sm:justify-start gap-2 text-xs text-neutral-500">
              <span className="font-light">Recent order:</span>
              <button
                type="button"
                onClick={() => {
                  setOrderNumber(recentOrderNumber);
                  performLookup(recentOrderNumber);
                }}
                className="font-mono text-neutral-900 underline underline-offset-4 hover:text-black font-medium"
              >
                {recentOrderNumber}
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-6 p-4 bg-red-50/90 border border-red-200 text-red-700 text-xs sm:text-sm rounded-lg flex items-center gap-3 max-w-2xl mx-auto">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      {/* ─── ORDER DETAILS DISPLAY ─── */}
      {orderDetails && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          {/* Top Status Banner */}
          <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 mb-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-mono">Commission</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium bg-neutral-900 text-white">
                    {orderDetails.status}
                  </span>
                  {orderDetails.paymentStatus === 'paid' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Paid
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-light text-neutral-900 font-serif">
                  {orderDetails.orderNumber}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-xs text-neutral-500 font-light">
                <div>
                  <span className="text-neutral-400 block uppercase tracking-wider text-[10px] font-mono">Order Date</span>
                  <span className="text-neutral-800 font-medium font-mono">
                    {new Date(orderDetails.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {orderDetails.estimatedDeliveryDate && (
                  <div>
                    <span className="text-neutral-400 block uppercase tracking-wider text-[10px] font-mono">
                      Estimated Delivery
                    </span>
                    <span className="text-emerald-700 font-medium font-mono">
                      {orderDetails.estimatedDeliveryDate}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-neutral-400 block uppercase tracking-wider text-[10px] font-mono">Carrier</span>
                  <span className="text-neutral-800 font-medium">{orderDetails.courierPartner}</span>
                </div>
              </div>
            </div>

            {/* ─── VISUAL PROGRESS TIMELINE ─── */}
            <div className="pt-8">
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-8">
                Sartorial Milestones
              </h3>

              <div className="relative pl-6 sm:pl-8 border-l-2 border-neutral-200/90 ml-3 sm:ml-4 space-y-10">
                {orderDetails.timeline.map((step, idx) => {
                  const isCompleted = step.status === 'completed';
                  const isCurrent = step.status === 'current';

                  return (
                    <div key={step.key || idx} className="relative">
                      {/* Node Indicator */}
                      <div
                        className={`absolute -left-[31px] sm:-left-[39px] top-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                          isCompleted
                            ? 'bg-neutral-900 text-white shadow-sm ring-4 ring-white'
                            : isCurrent
                            ? 'bg-white text-neutral-900 border-2 border-neutral-900 ring-4 ring-neutral-100 animate-pulse'
                            : 'bg-white border-2 border-neutral-300 text-neutral-300'
                        }`}
                      >
                        {isCompleted ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : isCurrent ? (
                          <div className="w-2.5 h-2.5 bg-neutral-900 rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-neutral-300 rounded-full" />
                        )}
                      </div>

                      {/* Content */}
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                          <h4
                            className={`text-sm sm:text-base font-medium ${
                              isCompleted || isCurrent ? 'text-neutral-900 font-serif' : 'text-neutral-400'
                            }`}
                          >
                            {step.title}
                          </h4>
                          {step.timestamp && (
                            <span className="text-[11px] font-mono text-neutral-400">
                              {new Date(step.timestamp).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs sm:text-sm font-light leading-relaxed max-w-2xl ${
                            isCompleted || isCurrent ? 'text-neutral-600' : 'text-neutral-400'
                          }`}
                        >
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Carrier & AWB Details Callout if present */}
            {orderDetails.trackingNumber && (
              <div className="mt-10 p-5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-800">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 block">
                      Waybill Reference (AWB)
                    </span>
                    <span className="font-mono text-sm font-medium text-neutral-900">
                      {orderDetails.trackingNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyAwb(orderDetails.trackingNumber!)}
                    className="px-4 py-2 border border-neutral-300 rounded-lg text-xs font-mono text-neutral-700 hover:border-black hover:text-black transition-colors flex items-center gap-1.5"
                  >
                    {copiedAwb ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy AWB</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── TWO-COLUMN DETAILS: ITEMS & DELIVERY DESTINATION ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* Left 2 Cols: Wardrobe Selection */}
            <div className="lg:col-span-2 bg-white border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-6 pb-3 border-b border-neutral-100">
                Wardrobe Commission ({orderDetails.items.length})
              </h3>

              <div className="divide-y divide-neutral-100">
                {orderDetails.items.map((item, idx) => (
                  <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-20 object-cover bg-neutral-100 rounded-lg border border-neutral-200/70"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-neutral-900 truncate font-serif">{item.title}</h4>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">
                        Size: {item.size} • Color: {item.color}
                      </p>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right font-mono text-sm text-neutral-900 font-medium">
                      {item.unitPriceFormatted}
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              <div className="mt-6 pt-6 border-t border-neutral-100 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-500">
                  <span>Subtotal:</span>
                  <span className="font-mono text-neutral-800">{orderDetails.subtotalFormatted}</span>
                </div>
                {orderDetails.discountPaise > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Atelier Privilege Discount:</span>
                    <span className="font-mono">- {orderDetails.discountFormatted}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-500">
                  <span>Express Insured Courier:</span>
                  <span className="text-emerald-700 font-medium">{orderDetails.shippingFormatted}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base font-medium text-neutral-900 pt-3 border-t border-neutral-100">
                  <span className="font-serif">Total Commission Paid:</span>
                  <span className="font-mono">{orderDetails.totalFormatted}</span>
                </div>
              </div>
            </div>

            {/* Right Col: Destination & Concierge */}
            <div className="space-y-6">
              {/* Delivery Address */}
              <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs uppercase tracking-widest text-neutral-400 font-mono mb-4 pb-2 border-b border-neutral-100">
                  Shipping Destination
                </h3>
                <p className="text-sm font-medium text-neutral-900">{orderDetails.shippingName}</p>
                <p className="text-xs text-neutral-600 font-light mt-1">
                  {orderDetails.shippingCity}, {orderDetails.shippingState} - {orderDetails.shippingPincode}
                </p>
                <p className="text-xs text-neutral-500 font-light mt-0.5">{orderDetails.shippingCountry}</p>
              </div>

              {/* Concierge Care Card */}
              <div className="bg-neutral-900 text-white rounded-2xl p-6 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <h4 className="text-sm font-medium font-serif mb-1">Salon Concierge</h4>
                <p className="text-xs text-neutral-300 font-light leading-relaxed mb-4">
                  Need to schedule delivery, update building access, or speak to our tailoring team?
                </p>
                <div className="space-y-1.5 text-xs font-mono text-neutral-200">
                  <div>concierge@deynolddanny.com</div>
                  <div>+91 11 4820 9000</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};
