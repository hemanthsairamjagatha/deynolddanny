import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $totalCount, openCart } from '../../stores/cartStore';

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
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <span
        className={`cart-badge-count ${bouncing ? 'bounce' : ''}`}
        id="cart-badge-count"
      >
        {count}
      </span>
    </a>
  );
};

export default CartTrigger;
