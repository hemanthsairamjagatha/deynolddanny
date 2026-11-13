import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $cartItems, $formattedSubtotal } from '../../cart/store/cart.store';
import { submitCheckoutApi, verifyPaymentApi, type CheckoutPayload } from '../api/checkout.api';
import { sendOtpApi, verifyOtpApi, getProfileApi } from '../../auth/api/auth.api';
import { getAccessToken } from '../../../lib/api/client';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const CheckoutExperience: React.FC = () => {
  const items = useStore($cartItems);
  const formattedSubtotal = useStore($formattedSubtotal);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Address fields matching user's reference design
  const [country, setCountry] = useState('India');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [apartment, setApartment] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [phone, setPhone] = useState('');
  const [saveInfo, setSaveInfo] = useState(false);
  const [showPhoneInfo, setShowPhoneInfo] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string;
    total: string;
    name: string;
    address: string;
  } | null>(null);

  const fontStyle = {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  const font16 = {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '16px'
  };

  const inputStyle: React.CSSProperties = {
    ...font16,
    border: '1px solid #d4d4d4',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      setIsAuthenticated(true);
      getProfileApi().then((res) => {
        if (res.success && res.data) {
          setEmail(res.data.email);
          if (res.data.fullName) {
            const parts = res.data.fullName.split(' ');
            setFirstName(parts[0] || '');
            setLastName(parts.slice(1).join(' ') || '');
          }
        }
      });
    }
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    setErrorMessage(null);
    setIsVerifying(true);
    try {
      const res = await sendOtpApi(email);
      if (res.success) {
        setOtpSent(true);
      } else {
        setErrorMessage(res.error?.message || 'Failed to send verification code.');
      }
    } catch {
      setErrorMessage('Could not connect to authentication service.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    setErrorMessage(null);
    setIsVerifying(true);
    try {
      const res = await verifyOtpApi(email, otp);
      if (res.success) {
        setIsAuthenticated(true);
        setOtpSent(false);
      } else {
        setErrorMessage(res.error?.message || 'Invalid code. Please try again.');
      }
    } catch {
      setErrorMessage('Verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isAuthenticated) {
      setErrorMessage('Please verify your email in Step 1 to proceed with secure checkout.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      setErrorMessage('Please provide your first and last name.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Please provide your street address.');
      return;
    }
    if (!city.trim()) {
      setErrorMessage('Please provide your city.');
      return;
    }
    if (!postalCode.trim()) {
      setErrorMessage('Please provide your postal code.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Please provide your contact phone number.');
      return;
    }

    const payload: CheckoutPayload = {
      shippingName: fullName,
      shippingPhone: phone.trim(),
      shippingLine1: address.trim(),
      shippingLine2: apartment.trim() || undefined,
      shippingCity: city.trim(),
      shippingState: province.trim() || 'Maharashtra',
      shippingPincode: postalCode.trim(),
      shippingCountry: country,
    };

    setIsSubmitting(true);
    try {
      const res = await submitCheckoutApi(payload);
      if (!res.success || !res.data) {
        setErrorMessage(res.error?.message || 'Could not initialize order. Please check stock and try again.');
        setIsSubmitting(false);
        return;
      }

      const { orderId, orderNumber, totalPaise, razorpayOrderId, razorpayKeyId } = res.data;

      // If Razorpay order ID exists, launch the Razorpay Checkout sheet
      if (razorpayOrderId && razorpayKeyId) {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          setErrorMessage('Unable to load secure Razorpay gateway. Please check your connection.');
          setIsSubmitting(false);
          return;
        }

        const options = {
          key: razorpayKeyId,
          amount: totalPaise,
          currency: 'INR',
          name: 'DEYNOLD DANNY',
          description: `Sartorial Order ${orderNumber}`,
          image: '/logo.png',
          order_id: razorpayOrderId,
          prefill: {
            name: fullName,
            email: email,
            contact: phone.trim(),
          },
          theme: {
            color: '#111111',
          },
          modal: {
            ondismiss: () => {
              setIsSubmitting(false);
              setErrorMessage('Payment was cancelled. Your sartorial reservation remains held for 15 minutes.');
            },
          },
          handler: async (response: any) => {
            try {
              setIsSubmitting(true);
              const verifyRes = await verifyPaymentApi({
                orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              if (verifyRes.success) {
                setCompletedOrder({
                  orderNumber,
                  total: res.data?.totalFormatted || `₹ ${(totalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                  name: fullName,
                  address: `${address}, ${apartment ? apartment + ', ' : ''}${city}, ${province} ${postalCode}, ${country}`,
                });
              } else {
                setErrorMessage(
                  verifyRes.error?.message ||
                    'Payment captured but verification encountered an issue. Our concierge has been alerted.',
                );
              }
            } catch (err: any) {
              setErrorMessage(err.message || 'Payment verification failed.');
            } finally {
              setIsSubmitting(false);
            }
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          setIsSubmitting(false);
          setErrorMessage(`Payment declined: ${resp.error?.description || 'Transaction unsuccessful.'}`);
        });
        rzp.open();
      } else {
        // Fallback for orders confirmed directly or sandbox without online modal
        setCompletedOrder({
          orderNumber,
          total: res.data?.totalFormatted || formattedSubtotal,
          name: fullName,
          address: `${address}, ${apartment ? apartment + ', ' : ''}${city}, ${province} ${postalCode}, ${country}`,
        });
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during checkout.');
      setIsSubmitting(false);
    }
  };

  // Order Confirmed Screen
  if (completedOrder) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6 text-center font-montserrat" style={fontStyle}>
        <div className="w-16 h-16 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="text-[12px] uppercase tracking-[0.25em] text-neutral-400 block mb-2" style={fontStyle}>
          Sartorial Order Confirmed
        </span>
        <h1 className="text-3xl font-light text-neutral-900 mb-3" style={fontStyle}>
          Thank you for choosing DEYNOLD DANNY
        </h1>
        <p className="text-[16px] text-neutral-500 mb-6" style={font16}>
          Order Reference: <strong className="text-neutral-900">{completedOrder.orderNumber}</strong>
        </p>
        <div className="p-6 bg-neutral-50 border border-neutral-200/80 mb-8 text-left text-[16px] space-y-3" style={font16}>
          <div className="flex justify-between">
            <span className="text-neutral-500">Recipient:</span>
            <span className="text-neutral-900 font-medium">{completedOrder.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Delivery Address:</span>
            <span className="text-neutral-900 font-medium text-right max-w-xs">{completedOrder.address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Total Charged:</span>
            <span className="text-neutral-900 font-medium">{completedOrder.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Courier Service:</span>
            <span className="text-neutral-900 font-medium">Bespoke Insured Express</span>
          </div>
        </div>
        <a
          href="/"
          className="inline-block px-8 py-3.5 bg-neutral-900 text-white uppercase text-xs tracking-widest hover:bg-neutral-800 transition-colors"
          style={fontStyle}
        >
          Return to Storefront
        </a>
      </div>
    );
  }

  // Empty Cart Screen
  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-24 px-6 text-center font-montserrat" style={fontStyle}>
        <h1 className="text-2xl font-light text-neutral-900 mb-3" style={fontStyle}>
          Your Shopping Bag is Empty
        </h1>
        <p className="text-[16px] text-neutral-500 mb-8" style={font16}>
          Select handcrafted garments from our collection before proceeding to checkout.
        </p>
        <a
          href="/"
          className="inline-block px-8 py-3.5 bg-neutral-900 text-white uppercase text-xs tracking-widest hover:bg-neutral-800 transition-colors"
          style={fontStyle}
        >
          Explore Collection
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 font-montserrat" style={fontStyle}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left Column: Checkout Forms */}
        <div className="lg:col-span-7 space-y-8">
          {/* Step 1: Contact Information */}
          <div className="p-6 sm:p-8 border border-neutral-200/80 bg-white" style={font16}>
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-medium" style={fontStyle}>
                Step 1: Contact Information
              </span>
              {isAuthenticated && (
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5" style={fontStyle}>
                  Verified Client
                </span>
              )}
            </div>

            {isAuthenticated ? (
              <p className="text-[16px] text-neutral-700" style={font16}>
                Signed in as: <strong className="text-neutral-900">{email}</strong>
              </p>
            ) : !otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-[16px] text-neutral-600 leading-relaxed" style={font16}>
                  Enter your email address to receive order updates and track your delivery.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@domain.com"
                    required
                    className="checkout-input flex-1 h-12 px-4 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white"
                    style={{ ...inputStyle }}
                  />
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="px-6 py-2.5 bg-neutral-900 text-white uppercase text-xs tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 rounded-[4px] font-bold"
                    style={fontStyle}
                  >
                    {isVerifying ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-[16px] text-neutral-600" style={font16}>
                  We sent a 6-digit code to <strong>{email}</strong>. Enter it below:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    className="checkout-input w-36 h-12 px-4 text-center tracking-[0.3em] text-[16px] text-neutral-900 bg-white"
                    style={{ ...inputStyle }}
                  />
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="px-6 py-2.5 bg-neutral-900 text-white uppercase text-xs tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 rounded-[4px] font-bold"
                    style={fontStyle}
                  >
                    {isVerifying ? 'Verifying...' : 'Confirm'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Step 2: Delivery Details (Directly Matching User's Reference Design) */}
          <div className="p-6 sm:p-8 border border-neutral-200/80 bg-white" style={font16}>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-medium block pb-4 border-b border-neutral-100 mb-6" style={fontStyle}>
              Step 2: Delivery Details
            </span>

            {/* Top helper text from user's image with exact 16px font size */}
            <p className="text-[16px] text-neutral-600 mb-4" style={font16}>
              This will also be used as your billing address for this order.
            </p>

            {errorMessage && (
              <div className="p-3.5 mb-5 bg-red-50 border border-red-200 text-red-700 text-[14px] rounded-[4px]" style={fontStyle}>
                {errorMessage}
              </div>
            )}

            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-3.5">
              {/* Field 1: Country/Region Dropdown */}
              <div
                className="checkout-input relative border border-neutral-300 rounded-[4px] px-3.5 pt-2 pb-1.5 bg-white focus-within:border-black transition-colors"
                style={{
                  border: '1px solid #d4d4d4',
                  backgroundColor: '#ffffff',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              >
                <label className="block text-xs text-neutral-500 leading-tight select-none" style={fontStyle}>
                  Country/Region
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-transparent text-[16px] text-neutral-900 focus:outline-none appearance-none pr-8 cursor-pointer font-normal leading-tight pt-0.5"
                  style={font16}
                  aria-label="Country or Region"
                >
                  <option value="India">India</option>
                  <option value="Italy">Italy</option>
                  <option value="France">France</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Germany">Germany</option>
                  <option value="Spain">Spain</option>
                  <option value="Switzerland">Switzerland</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Japan">Japan</option>
                  <option value="Australia">Australia</option>
                </select>
                <svg
                  className="w-4 h-4 text-neutral-500 absolute right-3.5 bottom-2.5 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              {/* Row 2: First name & Last name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    className="checkout-input w-full h-12 px-3.5 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                    style={{ ...inputStyle }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    className="checkout-input w-full h-12 px-3.5 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                    style={{ ...inputStyle }}
                  />
                </div>
              </div>

              {/* Row 3: Address (with Search icon) */}
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address"
                  required
                  className="checkout-input w-full h-12 pl-3.5 pr-10 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                  style={{ ...inputStyle }}
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              </div>

              {/* Row 4: Apartment, suite, etc. (optional) */}
              <div>
                <input
                  type="text"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                  className="checkout-input w-full h-12 px-3.5 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                  style={{ ...inputStyle }}
                />
              </div>

              {/* Row 5: Postal code, City, Province (3 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Postal code"
                    required
                    className="checkout-input w-full h-12 px-3.5 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                    style={{ ...inputStyle }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    required
                    className="checkout-input w-full h-12 px-3.5 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                    style={{ ...inputStyle }}
                  />
                </div>
                <div className="relative">
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                    className={`checkout-input w-full h-12 px-3.5 text-[16px] appearance-none bg-white pr-8 cursor-pointer transition-colors ${
                      province ? 'text-neutral-900' : 'text-neutral-500'
                    }`}
                    style={{ ...inputStyle }}
                    aria-label="Province"
                  >
                    <option value="" disabled>Province</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Telangana">Telangana</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Rome">Rome</option>
                    <option value="Milan">Milan</option>
                    <option value="Florence">Florence</option>
                    <option value="Venice">Venice</option>
                    <option value="Turin">Turin</option>
                    <option value="Bologna">Bologna</option>
                    <option value="Naples">Naples</option>
                    <option value="Other">Other / International</option>
                  </select>
                  <svg
                    className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>

              {/* Row 6: Phone (with help info ? icon) */}
              <div>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone"
                    required
                    className="checkout-input w-full h-12 pl-3.5 pr-10 text-[16px] text-neutral-900 placeholder:text-neutral-500 bg-white transition-colors"
                    style={{ ...inputStyle }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPhoneInfo(!showPhoneInfo)}
                    title="In case we need to contact you about your delivery"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </button>
                </div>
                {showPhoneInfo && (
                  <p className="text-[14px] text-neutral-500 mt-1 pl-1" style={fontStyle}>
                    In case we need to contact you about your order or courier delivery.
                  </p>
                )}
              </div>

              {/* Row 7: Checkbox: Save this information for next time */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveInfo}
                    onChange={(e) => setSaveInfo(e.target.checked)}
                    className="w-4 h-4 rounded-[4px] border-neutral-300 text-black focus:ring-black cursor-pointer"
                  />
                  <span className="text-[16px] text-neutral-900 font-normal" style={font16}>
                    Save this information for next time
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-neutral-900 text-white uppercase text-[15px] font-bold tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 rounded-[4px]"
                  style={fontStyle}
                >
                  {isSubmitting ? 'Reserving Stock & Authorizing...' : 'Authorize & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 bg-neutral-50/70 p-6 sm:p-8 border border-neutral-200/80 sticky top-24" style={fontStyle}>
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-medium block pb-4 border-b border-neutral-200 mb-6" style={fontStyle}>
            Wardrobe Selection ({items.length})
          </span>

          <div className="divide-y divide-neutral-200 max-h-96 overflow-y-auto mb-6">
            {items.map((item, idx) => (
              <div key={idx} className="py-4 flex gap-4 items-center">
                <img
                  src={item.img}
                  alt={item.title}
                  className="w-16 h-20 object-cover bg-neutral-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-[15px] uppercase font-medium tracking-wide truncate text-neutral-900" style={fontStyle}>
                    {item.title}
                  </h4>
                  <p className="text-[13px] text-neutral-500 mt-0.5" style={fontStyle}>
                    Size: {item.size} &bull; Qty: {item.qty}
                  </p>
                  <p className="text-[15px] text-neutral-800 font-medium mt-1" style={fontStyle}>
                    {item.price}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-neutral-200 pt-4 text-[16px]" style={font16}>
            <div className="flex justify-between text-neutral-600" style={font16}>
              <span>Subtotal:</span>
              <span className="text-neutral-900 font-medium" style={font16}>{formattedSubtotal}</span>
            </div>
            <div className="flex justify-between text-neutral-600" style={font16}>
              <span>Express Insured Shipping:</span>
              <span className="text-emerald-700 font-medium" style={font16}>Complimentary</span>
            </div>
            <div className="flex justify-between text-neutral-600" style={font16}>
              <span>VAT / GST:</span>
              <span style={font16}>Included</span>
            </div>
            <div className="flex justify-between border-t border-neutral-300 pt-3 text-[18px] font-bold text-neutral-900" style={fontStyle}>
              <span>Total Payable:</span>
              <span>{formattedSubtotal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutExperience;
