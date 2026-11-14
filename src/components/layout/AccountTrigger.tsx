import React, { useState, useEffect, useRef } from 'react';
import { getStoredClientEmail, getAccessToken } from '../../lib/api/client';
import { logoutApi } from '../../features/auth/api/auth.api';

export const AccountTrigger: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = getStoredClientEmail();
    const token = getAccessToken();
    if (stored && (token || true)) {
      setEmail(stored);
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    setEmail(null);
    setIsOpen(false);
    window.location.href = '/';
  };

  const fontStyle = {
    fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  // If user is not logged in, render standard sign-in link
  if (!email) {
    return (
      <a
        href="/account/sign-in"
        className="header-icon-link relative flex items-center justify-center text-neutral-800 hover:text-black transition-colors"
        aria-label="Client Sign In"
        title="Sign In"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
        </svg>
      </a>
    );
  }

  // If user is logged in, render interactive account badge with dropdown
  return (
    <div className="relative inline-block text-left" ref={dropdownRef} style={fontStyle}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="header-icon-link relative flex items-center justify-center text-neutral-900 hover:text-black transition-colors cursor-pointer group"
        aria-label="Client Account Options"
        title={`Signed in as ${email}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
        </svg>
        {/* Active Session Indicator Dot */}
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-600 rounded-full border-2 border-white"
          title="Active Session"
        />
      </button>

      {/* Luxury Account Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-3 w-64 bg-white border border-neutral-200/90 shadow-xl rounded-md p-4 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150"
          style={fontStyle}
        >
          <div className="pb-3 border-b border-neutral-100">
            <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-mono block mb-1">
              Private Client
            </span>
            <p className="text-xs font-medium text-neutral-900 truncate" title={email}>
              {email}
            </p>
          </div>

          <div className="py-2 space-y-1">
            <a
              href="/account"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 rounded transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Client Dashboard</span>
            </a>

            <a
              href="/orders/track"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 rounded transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Track Orders</span>
            </a>

            <a
              href="/wishlist"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 rounded transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>Saved Wishlist</span>
            </a>
          </div>

          <div className="pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
