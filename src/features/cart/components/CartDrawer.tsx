import React, { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $cartItems,
  $isCartOpen,
  $totalCount,
  $formattedSubtotal,
  closeCart,
  incrementQuantity,
  decrementQuantity,
  updateQuantity,
  removeFromCart,
  initInspectListeners
} from '../store/cart.store';

export const CartDrawer: React.FC = () => {
  const items = useStore($cartItems);
  const isOpen = useStore($isCartOpen);
  const count = useStore($totalCount);
  const formattedSubtotal = useStore($formattedSubtotal);

  useEffect(() => {
    initInspectListeners();
  }, []);

  const openClasses = isOpen ? 'is-open is-visible' : '';

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`cart-backdrop ${openClasses}`}
        id="cart-backdrop"
        aria-hidden={!isOpen}
        onClick={closeCart}
      />

      {/* Cart Drawer Slide-over */}
      <aside
        className={`cart-drawer text-colors-default background-colors-default ${openClasses}`}
        id="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
        aria-hidden={!isOpen}
      >
        <div className="cart-drawer-inner">
          {/* Top Row: Dismiss / Close Long Arrow */}
          <div className="cart-drawer-header">
            <button
              type="button"
              className="cart-drawer-close"
              id="cart-drawer-close"
              aria-label="Close cart drawer"
              onClick={closeCart}
            >
              <svg
                width="72"
                height="34"
                viewBox="0 0 72 34"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path id="cart-close-line" className="cart-close-line" d="M0 16.865H71.21" />
                <path
                  id="cart-close-arrow"
                  className="cart-close-arrow"
                  d="M55.44 0C58.5 7.5 64 13.5 71.21 16.865C64 20.2 58.5 26.2 55.44 33.73"
                  fill="none"
                />
              </svg>
            </button>
          </div>

          {/* Main Title Container */}
          <div className="cart-drawer__head cart-drawer-title-wrap font-montserrat" id="cart-drawer-head">
            <p className="cart-drawer-title cart-drawer__title h2 font-montserrat" id="cart-drawer-heading">
              {count > 0 ? `My Cart ( ${count} )` : 'My Cart'}
            </p>
          </div>

          {/* Empty State Divider (Only visible when empty) */}
          {items.length === 0 && (
            <div className="cart-drawer-divider" id="cart-drawer-divider" />
          )}

          {/* Main Drawer Body Container */}
          <div
            id="CartDrawer-Body"
            className="cart-drawer__body cart-drawer_body--pb-none cart-drawer-content"
          >
            {items.length === 0 ? (
              /* Empty State */
              <div className="cart-empty-state" id="cart-empty-state">
                <p className="cart-empty-text">Your Cart Is Empty</p>
                <button
                  type="button"
                  className="cart-continue-btn"
                  id="cart-continue-btn"
                  onClick={closeCart}
                >
                  continue shopping
                </button>
              </div>
            ) : (
              /* Populated State */
              <div className="cart-items-wrap" id="cart-items-wrap">
                <ul className="cart-items-list" id="cart-items-list">
                  {items.map((item, index) => (
                    <li className="cart-item" key={`${item.id}-${item.size}-${index}`}>
                      <img
                        src={item.img}
                        alt={item.title}
                        className="cart-item-img"
                        loading="lazy"
                      />
                      <div className="cart-item__details cart-item-details font-montserrat">
                        <div className="cart-item-title-row">
                          <p className="cart-item-title font-montserrat">{item.title}</p>
                        </div>
                        <dl className="cart-item-size font-montserrat">
                          <dt>SIZE:</dt>
                          <dd>{item.size}</dd>
                        </dl>
                        <div className="cart-item-price font-montserrat">{item.price}</div>
                        <div className="cart-item__quantity">
                          <div className="quantity cart-qty-box">
                            <button
                              type="button"
                              className="quantity__button cart-qty-btn cart-qty-minus"
                              name="minus"
                              aria-label="Decrease button"
                              onClick={() => decrementQuantity(index)}
                            >
                              &minus;
                            </button>
                            <input
                              type="number"
                              className="quantity__input"
                              id={`ProductQuantity-${index + 1}-`}
                              name="updates[]"
                              value={item.qty}
                              min="0"
                              aria-label="Quantity:"
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
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="cart-remove-button">
                          <a
                            href="#"
                            className="button button--tertiary cart-item-remove"
                            role="link"
                            aria-label="Remove"
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
            )}
          </div>

          {/* Sticky Summary Wrapper */}
          <div
            className="cart-drawer__summary cart-drawer__summary--sticky cart-drawer__footer cart-drawer-footer"
            id="cart-drawer-footer"
          >
            <div id="cart-summary" className="cart-summary">
              <div className="shipping-bar progress-bar cart-drawer__bar">
                <p className="progress-bar__text h6">
                  Congrats! You're qualified for free shipping!
                </p>
                <div className="progress-bar__progress">
                  <span className="progress-bar__progress-inner" />
                </div>
              </div>
              <div className="cart-drawer__summary-total h4">
                <span>Subtotal:</span>
                <span className="cart-subtotal-val" id="cart-subtotal-val">
                  {items.length === 0 ? '₹ 0.00 INR' : formattedSubtotal}
                </span>
              </div>
              <div className="cart-drawer__summary-actions">
                <button
                  type="button"
                  className="button button--filled button--lowercase button--full cart-checkout-btn"
                  id="cart-checkout-btn"
                  aria-label="checkout button"
                  onClick={e => {
                    e.preventDefault();
                    if (items.length === 0) return;
                    closeCart();
                    window.location.href = '/checkout';
                  }}
                >
                  checkout
                </button>
                <a
                  href="/cart"
                  className="button button--outlined button--lowercase button--full cart-view-cart-btn"
                  id="cart-view-cart-btn"
                  role="link"
                  aria-label="view cart"
                  onClick={() => {
                    closeCart();
                  }}
                >
                  view cart
                </a>
              </div>
              <p className="cart-drawer__summary-tax center">Tax included</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default CartDrawer;

