/** Validate integer quantity > 0, optionally ≤ max */
export function validateQty(text: string, max?: number): string | null {
  const n = Number.parseInt(text, 10);
  if (Number.isNaN(n) || n <= 0) return 'Enter a valid quantity';
  if (!Number.isInteger(Number(text))) return 'Quantity must be a whole number';
  if (max !== undefined && n > max) return `Cannot exceed ${max}`;
  return null;
}

/** Validate that a quote exists for trading */
export function validateHasPrice(quote: { ltpPaise: number } | undefined): string | null {
  return quote ? null : 'No live price available';
}
