import React from 'react';
import { openSearch } from '../store/search.store';

export const SearchTrigger: React.FC = () => {
  return (
    <button
      type="button"
      className="header-icon-link bg-transparent border-0 cursor-pointer p-0 text-current flex items-center justify-center"
      aria-label="Search Collection"
      onClick={(e) => {
        e.preventDefault();
        openSearch();
      }}
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
        <circle cx="10.5" cy="10.5" r="7.5"></circle>
        <line x1="21" y1="21" x2="16" y2="16"></line>
      </svg>
    </button>
  );
};

export default SearchTrigger;

