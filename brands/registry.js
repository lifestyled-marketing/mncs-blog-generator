import * as MN from './MN/index.js';
import * as EC from './EC/index.js';

const brands = {
  MN,
  EC,
};

export function getBrand(code) {
  if (typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  return brands[normalized] || null;
}

export function listBrandCodes() {
  return Object.keys(brands);
}
