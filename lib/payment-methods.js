// Which card networks + wallets are offered depends on the customer's country.
// Brand detection stays purely client-side (no PAN leaves the browser).

export const ALL_NETWORKS = ['visa', 'mastercard', 'amex', 'rupay', 'discover'];

const NETWORKS_BY_COUNTRY = {
  IN: ['visa', 'mastercard', 'rupay', 'amex'],
  US: ['visa', 'mastercard', 'amex', 'discover'],
  GB: ['visa', 'mastercard', 'amex'],
  CA: ['visa', 'mastercard', 'amex', 'discover'],
  AU: ['visa', 'mastercard', 'amex'],
  AE: ['visa', 'mastercard', 'amex'],
  SG: ['visa', 'mastercard', 'amex'],
};

const WALLETS_BY_COUNTRY = {
  IN: ['Paytm', 'PhonePe', 'Amazon Pay', 'Google Pay'],
  US: ['PayPal', 'Apple Pay', 'Google Pay', 'Amazon Pay'],
  GB: ['PayPal', 'Apple Pay', 'Google Pay'],
  CA: ['PayPal', 'Apple Pay', 'Google Pay'],
  AU: ['PayPal', 'Apple Pay', 'Google Pay'],
  AE: ['PayPal', 'Apple Pay', 'Google Pay'],
  SG: ['GrabPay', 'PayPal', 'Apple Pay', 'Google Pay'],
};

export function acceptedNetworks(country) {
  return NETWORKS_BY_COUNTRY[country] || ['visa', 'mastercard', 'amex'];
}

export function wallets(country) {
  return WALLETS_BY_COUNTRY[country] || ['PayPal', 'Apple Pay', 'Google Pay'];
}

export const NETWORK_LABEL = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  rupay: 'RuPay',
  discover: 'Discover',
  card: 'Card',
  unknown: 'Card',
};

export function detectBrand(num) {
  if (!num) return 'unknown';
  if (/^4/.test(num)) return 'visa';
  if (/^3[47]/.test(num)) return 'amex';
  if (/^(60|65|81|82|508)/.test(num)) return 'rupay';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'mastercard';
  if (/^6(011|5)/.test(num)) return 'discover';
  return 'unknown';
}
