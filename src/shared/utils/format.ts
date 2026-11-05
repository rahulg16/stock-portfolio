import { formatINR, formatPercent, formatSignedINR, formatIndianInteger } from '../../domain/money';

/** Format paise as INR with Indian grouping: ₹12,34,567.89 */
export const fmtINR = (paise: number | null | undefined): string =>
  paise === null || paise === undefined ? '—' : formatINR(paise);

/** Format paise as signed INR: +₹1,234.56 / -₹1,234.56 / ₹0.00 */
export const fmtSignedINR = (paise: number | null | undefined): string =>
  paise === null || paise === undefined ? '—' : formatSignedINR(paise);

/** Format percentage: +1.23% / -0.45% / — */
export const fmtPct = (pct: number | null | undefined): string =>
  pct === null || pct === undefined || Number.isNaN(pct) ? '—' : formatPercent(pct);

/** Format integer with Indian grouping: 1,52,93,551 */
export const fmtInt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : formatIndianInteger(n);

/** Format volume compactly: 1.53Cr / 15.29L / 1,234 */
export const fmtVolume = (vol: number | null | undefined): string => {
  if (vol === null || vol === undefined) return '—';
  if (vol >= 1_00_00_000) return `${(vol / 1_00_00_000).toFixed(2)}Cr`;
  if (vol >= 1_00_000) return `${(vol / 1_00_000).toFixed(2)}L`;
  return formatIndianInteger(vol);
};

/** Relative time: "2s ago" / "1m ago" / "3h ago" / "5d ago" */
export const fmtRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
};
