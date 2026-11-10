// Money formatting — always integer paise internally, formatted strings for display

/**
 * Converts integer paise to a formatted INR display string.
 * Example: 7250000 → "₹ 72,500.00"
 */
export function formatPaiseToDisplay(paise: number): string {
  const rupees = paise / 100;
  return `₹ ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Converts integer paise to integer rupees.
 * Example: 7250000 → 72500
 */
export function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}

/**
 * Converts integer rupees to integer paise.
 * Example: 72500 → 7250000
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Converts paise to float rupees string for Cashfree API.
 * Example: 7250000 → "72500.00"
 * ONLY use at the Cashfree API boundary.
 */
export function paiseToRupeesFloat(paise: number): string {
  return (paise / 100).toFixed(2);
}

