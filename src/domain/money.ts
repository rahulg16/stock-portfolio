import type { MoneyPaise } from './types';

/**
 * Money helpers. All values are integer paise; formatting is done by hand so it
 * does not depend on the device's Intl/locale data (Hermes Intl support varies).
 */

/** Converts rupee input to integer paise, rounding to the nearest paise. */
export function toPaise(rupees: number): MoneyPaise {
  if (!Number.isFinite(rupees)) {
    throw new Error(`Cannot convert non-finite rupee value: ${rupees}`);
  }
  return Math.round(rupees * 100);
}

export function fromPaise(paise: MoneyPaise): number {
  return paise / 100;
}

/** Groups the integer part using the Indian lakh/crore convention. */
export function groupIndianDigits(digits: string): string {
  if (!/^\d+$/.test(digits)) {
    throw new Error(`Expected a non-negative integer string, received "${digits}"`);
  }
  if (digits.length <= 3) {
    return digits;
  }
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const groups: string[] = [];
  let end = rest.length;
  while (end > 0) {
    const start = Math.max(0, end - 2);
    groups.unshift(rest.slice(start, end));
    end = start;
  }
  return `${groups.join(',')},${lastThree}`;
}

/** Formats integer paise as `₹12,34,567.89`, with a leading `-` for negatives. */
export function formatINR(paise: MoneyPaise): string {
  if (!Number.isSafeInteger(paise)) {
    throw new Error(`Money must be integer paise, received ${paise}`);
  }
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  return `${sign}₹${groupIndianDigits(String(rupees))}.${String(fraction).padStart(2, '0')}`;
}

/**
 * Formats a P&L amount with an explicit sign. Zero is rendered without a sign
 * because "+₹0.00" reads like a gain when nothing has moved.
 */
export function formatSignedINR(paise: MoneyPaise): string {
  if (paise === 0) {
    return formatINR(0);
  }
  return paise > 0 ? `+${formatINR(paise)}` : formatINR(paise);
}

/** Formats a percentage with an explicit sign. `null` renders as an em dash. */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }
  const rounded = Math.abs(value).toFixed(2);
  if (Number(rounded) === 0) {
    return `${rounded}%`;
  }
  return `${value > 0 ? '+' : '-'}${rounded}%`;
}

/** Formats a non-negative/negative integer (e.g. volume, quantity) with Indian grouping. */
export function formatIndianInteger(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Expected an integer, received ${value}`);
  }
  const sign = value < 0 ? '-' : '';
  return `${sign}${groupIndianDigits(String(Math.abs(value)))}`;
}

export const MISSING_VALUE = '—';
