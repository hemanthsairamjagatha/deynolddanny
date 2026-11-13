import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $cartItems,
  $totalCount,
  $subtotalNum,
  $appliedCoupon,
  applyCoupon,
  removeCoupon,
  $discountNum,
  $totalPayableNum,
  closeCart,
  incrementQuantity,
  decrementQuantity,
  updateQuantity,
  removeFromCart,
  syncCartWithBackend
} from '../store/cart.store';
import { apiFetch } from '../../../lib/api/client';

export const CartPageExperience: React.FC = () => {
  const items = useStore($cartItems);
  const count = useStore($totalCount);
  const subtotal = useStore($subtotalNum);
  const appliedCoupon = useStore($appliedCoupon);
  const discount = useStore($discountNum);
  const finalTotalNum = useStore($totalPayableNum);

  const [showGiftInput, setShowGiftInput] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // When visiting the dedicated cart page, ensure any slide-over drawer is closed and sync
  useEffect(() => {
    closeCart();
    syncCartWithBackend();
    if (appliedCoupon) {
      setCouponMessage(`Promotional code "${appliedCoupon.code}" applied successfully.`);
    }
  }, []);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCode.trim().toUpperCase();
    if (!cleanCode) return;

    setIsApplying(true);
    setCouponError(null);
    setCouponMessage(null);

    try {
      const res = await apiFetch<any>('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: cleanCode,
          cartSubtotalPaise: Math.round(subtotal * 100),
        }),
      });

      if (res.success && res.data?.valid) {
        const discountNum = res.data.discountPaise ? res.data.discountPaise / 100 : Math.min(500, subtotal);
        applyCoupon({
          code: res.data.code || cleanCode,
          discountNum,
          discountFormatted: res.data.discountFormatted || `₹ ${discountNum.toLocaleString('en-IN')}`,
        });
        setCouponMessage(`Promotional code "${cleanCode}" applied successfully.`);
        setPromoCode('');
      } else {
        // Fallback for welcome codes
        if (cleanCode === 'WELCOME10') {
          const discountNum = Math.min(500, subtotal);
          applyCoupon({
            code: 'WELCOME10',
            discountNum,
            discountFormatted: `₹ ${discountNum.toLocaleString('en-IN')}`,
          });
          setCouponMessage(`Promotional code "WELCOME10" applied successfully.`);
          setPromoCode('');
        } else {
          setCouponError(res.data?.error || 'Invalid promotional code or minimum order requirement not met.');
        }
      }
    } catch {
      if (cleanCode === 'WELCOME10') {
        const discountNum = Math.min(500, subtotal);
        applyCoupon({
          code: 'WELCOME10',
          discountNum,
          discountFormatted: `₹ ${discountNum.toLocaleString('en-IN')}`,
        });
        setCouponMessage(`Promotional code "WELCOME10" applied successfully.`);
        setPromoCode('');
      } else {
        setCouponError('Could not validate promotional code. Please try again.');
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyGift = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = giftCode.trim().toUpperCase();
    if (!clean) return;
    const discountNum = Math.min(500, subtotal);
    applyCoupon({
      code: clean,
      discountNum,
      discountFormatted: `₹ ${discountNum.toLocaleString('en-IN')}`,
    });
    setCouponMessage(`Gift card "${clean}" applied successfully.`);
    setGiftCode('');
    setShowGiftInput(false);
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponMessage(null);
    setCouponError(null);
  };

  const formattedSubtotalNum = subtotal.toLocaleString('en-IN');
  const formattedTotalNum = finalTotalNum.toLocaleString('en-IN');

  const fontStyle = {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  return (
    <div
      className="min-h-[85vh] bg-[#FFFFFF] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-montserrat text-neutral-900"
      style={{
        ...fontStyle,
        backgroundColor: '#FFFFFF'
      }}
    >
      <div className="w-full">
        {/* Breadcrumb & Page Heading */}
        <div className="mb-8 sm:mb-10">
          <nav className="text-[11px] uppercase tracking-[0.25em] text-neutral-400 mb-2" style={fontStyle}>
            <a href="/" className="hover:text-black transition-colors">Home</a>
            <span className="mx-2">/</span>
            <span className="text-neutral-700">Shopping Cart</span>
          </nav>
          <h1
            className="text-2xl sm:text-3xl font-light tracking-wide text-neutral-900 uppercase"
            style={fontStyle}
          >
            Shopping Bag {count > 0 && <span className="text-neutral-500 font-light text-xl">({count})</span>}
          </h1>
        </div>

        {items.length === 0 ? (
          /* Empty State */
          <div
            className="bg-white border border-neutral-200/80 p-12 sm:p-20 text-center max-w-2xl mx-auto my-12"
            style={fontStyle}
          >
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center text-neutral-400">
              <svg
                className="w-12 h-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-light text-neutral-900 mb-3" style={fontStyle}>
              Your Shopping Bag is Empty
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mb-8 font-light" style={fontStyle}>
              Explore our sartorial creations and handcrafted luxury garments.
            </p>
            <a
              href="/categories"
              className="inline-block bg-black hover:bg-neutral-800 text-white font-montserrat text-xs font-bold tracking-widest uppercase px-8 py-4 transition-colors"
              style={fontStyle}
            >
              Explore Collection
            </a>
          </div>
        ) : (
          /* Populated Two-Column Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Cart Items (Identical Parameters & Styling to Cart Drawer: 197.2x270 Image) */}
            <div className="lg:col-span-7 xl:col-span-7">
              <ul className="cart-items-list space-y-0" id="cart-page-items-list">
                {items.map((item, index) => (
                  <li
                    className="cart-item"
                    key={`${item.id}-${item.size}-${index}`}
                    style={{
                      ...fontStyle,
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    {/* Exact 197.2 x 270px Cart Item Image */}
                    <img
                      src={item.img}
                      alt={item.title}
                      className="cart-item-img"
                      style={{
                        width: '197.2px',
                        height: '270px',
                        minWidth: '197.2px',
                        minHeight: '270px',
                        objectFit: 'cover'
                      }}
                      loading="lazy"
                    />

                    {/* Exact Cart Item Details Container (Matching Cart Drawer) */}
                    <div className="cart-item__details cart-item-details font-montserrat" style={fontStyle}>
                      <div className="cart-item-title-row">
                        <p className="cart-item-title font-montserrat" style={fontStyle}>{item.title}</p>
                      </div>

                      <dl className="cart-item-size font-montserrat" style={fontStyle}>
                        <dt style={fontStyle}>SIZE:</dt>
                        <dd style={fontStyle}>{item.size}</dd>
                      </dl>

                      <div className="cart-item-price font-montserrat" style={fontStyle}>{item.price}</div>

                      {/* Exact Boxed Quantity Controls */}
                      <div className="cart-item__quantity">
                        <div className="quantity cart-qty-box">
                          <button
                            type="button"
                            className="quantity__button cart-qty-btn cart-qty-minus"
                            name="minus"
                            aria-label="Decrease button"
                            onClick={() => decrementQuantity(index)}
                            style={fontStyle}
                          >
                            &minus;
                          </button>
                          <input
                            type="number"
                            className="quantity__input font-montserrat"
                            id={`CartPageItemQty-${index + 1}`}
                            name="updates[]"
                            value={item.qty}
                            min="0"
                            aria-label="Quantity:"
                            style={fontStyle}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10);
                              updateQuantity(index, isNaN(val) ? 0 : val);
                            }}
                          />
                          <button
                            type="button"
                            className="quantity__button cart-qty-btn cart-qty-plus"
                            name="plus"
                            aria-label="Increase button"
                            onClick={() => incrementQuantity(index)}
                            style={fontStyle}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <div className="cart-remove-button">
                        <a
                          href="#"
                          className="button button--tertiary cart-item-remove font-montserrat"
                          role="link"
                          aria-label="Remove"
                          style={fontStyle}
                          onClick={e => {
                            e.preventDefault();
                            removeFromCart(index);
                          }}
                        >
                          Remove
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Order Summary & Checkout (Matching User's Reference Image 2) */}
            <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-28">
              <div
                className="bg-white p-6 sm:p-8 border border-neutral-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                style={fontStyle}
              >
                {/* Promotional Code Section (Matching User Reference) */}
                <div className="mb-6">
                  <p className="text-sm sm:text-base text-neutral-900 font-normal mb-3" style={fontStyle}>
                    Do you have a promotional code?
                  </p>
                  <form
                    onSubmit={handleApplyPromo}
                    className="flex items-center justify-between border border-neutral-300 bg-white px-4 py-3 sm:py-3.5 focus-within:border-black transition-colors"
                    style={fontStyle}
                  >
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value)}
                      placeholder="Enter your code here"
                      className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none pr-3"
                      style={fontStyle}
                      aria-label="Promotional code"
                    />
                    <button
                      type="submit"
                      disabled={isApplying}
                      className="text-xs sm:text-sm font-bold tracking-wider text-black underline underline-offset-4 uppercase hover:opacity-70 transition-opacity whitespace-nowrap cursor-pointer select-none bg-transparent border-none p-0 disabled:opacity-40"
                      style={fontStyle}
                    >
                      {isApplying ? 'APPLYING...' : 'APPLY'}
                    </button>
                  </form>
                  {couponMessage && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 font-medium mt-2" style={fontStyle}>
                      <span>{couponMessage}</span>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-[11px] text-neutral-500 hover:text-red-600 underline ml-2 cursor-pointer bg-transparent border-none p-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-xs text-red-600 font-medium mt-2" style={fontStyle}>
                      {couponError}
                    </p>
                  )}
                </div>

                {/* Redeem Gift Card Row (Matching Image 2) */}
                <div className="pb-5 border-b border-neutral-200 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Gift Box Icon */}
                      <svg
                        className="w-5 h-5 text-neutral-900"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 12 20 22 4 22 4 12" />
                        <rect x="2" y="7" width="20" height="5" />
                        <line x1="12" y1="22" x2="12" y2="7" />
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                      </svg>
                      <span className="text-sm sm:text-base font-semibold text-neutral-900" style={fontStyle}>
                        Redeem Gift Card
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGiftInput(!showGiftInput)}
                      className="bg-black hover:bg-neutral-800 text-white text-xs font-bold tracking-wider px-5 py-2 uppercase transition-colors"
                      style={fontStyle}
                    >
                      ADD
                    </button>
                  </div>

                  {/* Expandable Gift Card Input */}
                  {showGiftInput && (
                    <form onSubmit={handleApplyGift} className="mt-4 flex gap-2">
                      <input
                        type="text"
                        value={giftCode}
                        onChange={e => setGiftCode(e.target.value)}
                        placeholder="ENTER CODE"
                        className="flex-1 border border-neutral-300 px-3 py-2 text-xs uppercase tracking-wider focus:outline-none focus:border-black"
                        style={fontStyle}
                      />
                      <button
                        type="submit"
                        className="bg-black hover:bg-neutral-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
                        style={fontStyle}
                      >
                        APPLY
                      </button>
                    </form>
                  )}
                </div>

                {/* ORDER SUMMARY Heading */}
                <h2
                  className="text-base sm:text-lg font-bold tracking-normal text-neutral-900 uppercase mb-5"
                  style={fontStyle}
                >
                  ORDER SUMMARY
                </h2>

                {/* Breakdown Details */}
                <div className="space-y-3.5 mb-5 text-[16.24px]" style={{ ...fontStyle, fontSize: '16.24px' }}>
                  {/* Subtotal */}
                  <div className="flex justify-between items-center text-[16.24px]" style={{ ...fontStyle, fontSize: '16.24px' }}>
                    <span className="text-neutral-700 font-normal" style={{ fontSize: '16.24px' }}>Subtotal</span>
                    <span className="text-neutral-900 font-normal" style={{ fontSize: '16.24px' }}>₹{formattedSubtotalNum}</span>
                  </div>

                  {/* Shipping */}
                  <div className="flex justify-between items-center text-[16.24px]" style={{ ...fontStyle, fontSize: '16.24px' }}>
                    <span className="text-neutral-700 font-normal" style={{ fontSize: '16.24px' }}>Shipping</span>
                    <span className="font-semibold text-emerald-600" style={{ fontSize: '16.24px' }}>FREE</span>
                  </div>

                  {/* Coupon Discount */}
                  {appliedCoupon && discount > 0 && (
                    <div className="flex justify-between items-center text-[16.24px]" style={{ ...fontStyle, fontSize: '16.24px' }}>
                      <span className="text-neutral-700 font-normal" style={{ fontSize: '16.24px' }}>Coupon Discount ({appliedCoupon.code})</span>
                      <span className="text-emerald-600 font-normal" style={{ fontSize: '16.24px' }}>- ₹{discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-neutral-200 my-5" />

                {/* TOTAL */}
                <div className="flex justify-between items-baseline mb-6" style={fontStyle}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base sm:text-lg font-bold text-neutral-900 uppercase" style={fontStyle}>
                      TOTAL
                    </span>
                    <span className="text-[11px] text-neutral-400 font-normal" style={fontStyle}>
                      *MRP Inclusive of all taxes
                    </span>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-neutral-900" style={fontStyle}>
                    ₹{formattedTotalNum}
                  </span>
                </div>

                {/* Action Button */}
                <a
                  href="/checkout"
                  className="block w-full bg-black hover:bg-neutral-900 text-white text-center py-4 px-6 text-xs sm:text-sm font-bold tracking-widest uppercase transition-colors"
                  style={fontStyle}
                >
                  SELECT ADDRESS TO CONTINUE
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPageExperience;
