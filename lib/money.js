// Amounts are stored as USD dollars (numeric). Keep it simple.
export function parseAmount(input) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100; // 2dp
}

export function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
  }).format(Number(amount));
}
