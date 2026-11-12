import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $totalCount, openCart } from '../store/cart.store';

export const CartTrigger: React.FC = () => {
  const count = useStore($totalCount);
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    if (count > 0) {
      setBouncing(true);
      const timer = setTimeout(() => setBouncing(false), 450);
      return () => clearTimeout(timer);
    }
  }, [count]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openCart();
  };

  return (
    <a
      href="#cart"
      onClick={handleClick}
      className="header-icon-link cart-icon-link"
      id="cart-drawer-trigger"
      aria-label="Open Shopping Bag"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="currentColor"
        aria-label="Bag 2 Icon"
        fontSize="medium"
        className="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall css-vpzthd"
        focusable="false"
        aria-hidden="true"
      >
        <path d="M22.1 7.9c-.2-.2-.5-.4-.8-.4h-3.8V6c0-1.4-1.1-2.5-2.5-2.5H9C7.6 3.5 6.5 4.6 6.5 6v1.5H2.7c-.3 0-.6.1-.8.4-.2.2-.3.6-.3.9l1.8 10.8c.1.5.5.9 1.1.9h15c.5 0 1-.4 1.1-.9l1.8-10.8c0-.3-.1-.7-.3-.9zM7.5 6c0-.8.7-1.5 1.5-1.5h6c.8 0 1.5.7 1.5 1.5v1.5h-9V6zm12.1 13.4c0 .1-.1.1 0 0l-15.1.1s-.1 0-.1-.1L2.6 8.6l.1-.1h18.6l.1.1-1.8 10.8z" />
      </svg>
      {Number.isFinite(count) && count > 0 && (
        <span
          className={`cart-badge cart-badge-count ${bouncing ? 'bounce' : ''}`}
          id="cart-badge-count"
        >
          {count}
        </span>
      )}
    </a>
  );
};

export default CartTrigger;

