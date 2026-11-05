import {
  formatINR,
  formatIndianInteger,
  formatPercent,
  formatSignedINR,
  fromPaise,
  groupIndianDigits,
  toPaise,
} from '../money';

describe('toPaise', () => {
  it('converts rupee values to integer paise', () => {
    expect(toPaise(1319.59)).toBe(131959);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(0)).toBe(0);
  });

  it('rejects non-finite input', () => {
    expect(() => toPaise(Number.NaN)).toThrow();
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('fromPaise', () => {
  it('converts integer paise back to rupees', () => {
    expect(fromPaise(131959)).toBeCloseTo(1319.59, 2);
  });
});

describe('groupIndianDigits', () => {
  it('uses the Indian lakh/crore grouping convention', () => {
    expect(groupIndianDigits('0')).toBe('0');
    expect(groupIndianDigits('123')).toBe('123');
    expect(groupIndianDigits('1234')).toBe('1,234');
    expect(groupIndianDigits('12345')).toBe('12,345');
    expect(groupIndianDigits('123456')).toBe('1,23,456');
    expect(groupIndianDigits('1234567')).toBe('12,34,567');
    expect(groupIndianDigits('10000000')).toBe('1,00,00,000');
  });

  it('rejects non-digit input', () => {
    expect(() => groupIndianDigits('12,34')).toThrow();
    expect(() => groupIndianDigits('-123')).toThrow();
  });
});

describe('formatINR', () => {
  it('formats positive amounts with Indian grouping and two paise digits', () => {
    expect(formatINR(123456789)).toBe('₹12,34,567.89');
    expect(formatINR(100)).toBe('₹1.00');
    expect(formatINR(5)).toBe('₹0.05');
    expect(formatINR(0)).toBe('₹0.00');
  });

  it('formats negatives with a leading minus', () => {
    expect(formatINR(-123456789)).toBe('-₹12,34,567.89');
    expect(formatINR(-5)).toBe('-₹0.05');
  });

  it('supports crore-scale values', () => {
    expect(formatINR(1_000_000_000)).toBe('₹1,00,00,000.00');
  });

  it('rejects fractional paise', () => {
    expect(() => formatINR(1.5)).toThrow();
  });
});

describe('formatSignedINR', () => {
  it('adds an explicit sign to non-zero values', () => {
    expect(formatSignedINR(123456)).toBe('+₹1,234.56');
    expect(formatSignedINR(-123456)).toBe('-₹1,234.56');
  });

  it('does not prefix zero with a plus sign', () => {
    expect(formatSignedINR(0)).toBe('₹0.00');
  });
});

describe('formatPercent', () => {
  it('formats with an explicit sign and two decimals', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-0.456)).toBe('-0.46%');
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('normalizes values that round to zero', () => {
    expect(formatPercent(0.001)).toBe('0.00%');
    expect(formatPercent(-0.001)).toBe('0.00%');
  });

  it('renders missing values as an em dash', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatIndianInteger', () => {
  it('formats volumes and quantities with Indian grouping', () => {
    expect(formatIndianInteger(15293551)).toBe('1,52,93,551');
    expect(formatIndianInteger(40)).toBe('40');
    expect(formatIndianInteger(-1200)).toBe('-1,200');
  });
});
