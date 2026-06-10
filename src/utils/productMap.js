export const SUPPORTED_PRODUCTS = new Set(['coca', 'sprite']);

export const PRODUCT_DISPLAY_NAMES = {
  coca: 'Coca-Cola',
  sprite: 'Sprite',
  cocacola: 'Coca-Cola',
  cocacolazero: 'Coca-Cola Zero',
  cocacolalight: 'Coca-Cola Light',
};

export function normalizeProductClass(value) {
  if (!value) {
    return '';
  }

  const normalized = String(value).trim().toLowerCase();
  const canonicalMap = {
    coca: 'coca','coca-cola': 'coca',
    cocacola: 'coca',
    cocacolazero: 'coca',
    cocacolalight: 'coca',
    sprite: 'sprite',
  };

  return canonicalMap[normalized] || normalized;
}

export function getDisplayName(className) {
  const normalized = String(className || '').trim().toLowerCase();
  return PRODUCT_DISPLAY_NAMES[normalized] || className;
}

export function isSupportedProduct(className) {
  return SUPPORTED_PRODUCTS.has(String(className || '').trim().toLowerCase());
}
