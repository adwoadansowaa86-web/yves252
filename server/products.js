import { toPesewas } from './money.js';

export class ValidationError extends Error {
  status = 400;
}

const text = (v, max) => String(v ?? '').trim().slice(0, max);

/**
 * Validates product fields coming from the admin (prices in cedis).
 * With partial=true only the provided fields are checked (for quick edits).
 */
export function productFromInput(input, { partial = false } = {}) {
  const out = {};
  const has = (key) => input[key] !== undefined;

  if (!partial || has('name')) {
    out.name = text(input.name, 120);
    if (!out.name) throw new ValidationError('Product name is required');
  }
  if (!partial || has('price')) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new ValidationError('Price must be a positive amount in cedis');
    out.price = toPesewas(price);
  }
  if (has('compareAtPrice')) {
    const v = input.compareAtPrice;
    out.compareAtPrice = v === null || v === '' ? null : toPesewas(v);
    if (out.compareAtPrice !== null && !(out.compareAtPrice > 0)) throw new ValidationError('Old price must be a positive amount');
  } else if (!partial) out.compareAtPrice = null;
  if (!partial || has('stock')) {
    const stock = Number(input.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0) throw new ValidationError('Stock must be a whole number, 0 or more');
    out.stock = stock;
  }
  if (!partial || has('category')) out.category = text(input.category, 60) || 'General';
  if (!partial || has('description')) out.description = text(input.description, 4000);
  if (!partial || has('images')) {
    const images = Array.isArray(input.images) ? input.images : [];
    out.images = images.map((u) => text(u, 500)).filter((u) => /^(https?:\/\/|\/uploads\/)/.test(u)).slice(0, 8);
  }
  if (!partial || has('active')) out.active = input.active === undefined ? true : Boolean(input.active);
  if (!partial || has('featured')) out.featured = Boolean(input.featured);
  return out;
}
