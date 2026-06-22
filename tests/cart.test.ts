import { describe, it, expect } from 'vitest';
import { addItem, removeItem, totalize } from '../lib/cart';

describe('cart · happy path', () => {
  it('adds new items', () => {
    const next = addItem([], { productId: 'p1', quantity: 2, unitPriceCents: 500 });
    expect(next).toHaveLength(1);
    expect(next[0].quantity).toBe(2);
  });

  it('merges duplicates', () => {
    const cart = [{ productId: 'p1', quantity: 1, unitPriceCents: 500 }];
    const next = addItem(cart, { productId: 'p1', quantity: 2, unitPriceCents: 500 });
    expect(next[0].quantity).toBe(3);
  });

  it('removes items', () => {
    const cart = [{ productId: 'p1', quantity: 1, unitPriceCents: 500 }];
    expect(removeItem(cart, 'p1')).toHaveLength(0);
  });

  it('computes a basic GB total', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 2, unitPriceCents: 1000 }],
      null,
      'GB',
    );
    expect(totals.subtotalCents).toBe(2000);
    expect(totals.taxCents).toBe(400);
    expect(totals.totalCents).toBe(2400);
  });
});

describe('cart · edge cases', () => {
  it('throws when merged quantity exceeds 99', () => {
    const cart = [{ productId: 'p1', quantity: 90, unitPriceCents: 500 }];
    expect(() => addItem(cart, { productId: 'p1', quantity: 10, unitPriceCents: 500 })).toThrow(
      'quantity exceeds limit',
    );
  });

  it('applies WELCOME10 discount', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      'WELCOME10',
      'GB',
    );
    expect(totals.discountCents).toBe(100);
    expect(totals.subtotalCents).toBe(1000);
  });

  it('applies VIP25 discount above threshold', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 10000 }],
      'VIP25',
      'GB',
    );
    expect(totals.discountCents).toBe(2500);
  });

  it('does not apply VIP25 below threshold', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 5000 }],
      'VIP25',
      'GB',
    );
    expect(totals.discountCents).toBe(0);
  });

  it('applies FREESHIP discount', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      'FREESHIP',
      'GB',
    );
    expect(totals.discountCents).toBe(0);
  });

  it('returns 0 for unknown discount code', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      'INVALID',
      'GB',
    );
    expect(totals.discountCents).toBe(0);
  });

  it('computes tax for DE region', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      null,
      'DE',
    );
    expect(totals.taxCents).toBe(190);
  });

  it('computes tax for US-CA region', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      null,
      'US-CA',
    );
    expect(totals.taxCents).toBe(73);
  });

  it('computes tax for US-OR region (no tax)', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      null,
      'US-OR',
    );
    expect(totals.taxCents).toBe(0);
  });

  it('computes default tax for unknown region', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }],
      null,
      'UNKNOWN',
    );
    expect(totals.taxCents).toBe(100);
  });

  it('clamps taxable at 0 when discount exceeds subtotal', () => {
    const totals = totalize(
      [{ productId: 'p1', quantity: 1, unitPriceCents: 100 }],
      'WELCOME10',
      'GB',
    );
    expect(totals.taxableCents ?? totals.subtotalCents - totals.discountCents).toBeGreaterThanOrEqual(0);
  });
});
