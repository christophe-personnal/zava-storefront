import { describe, it, expect, beforeEach, vi } from 'vitest';
import { canCancel, fulfillmentMessage, summarize, createOrder, findOrder } from '../lib/orders';
import type { Db } from '../lib/db';

describe('orders · pure helpers', () => {
  it('only pending orders can be cancelled', () => {
    expect(canCancel({ id: 'x', userId: 'u', totalCents: 1, status: 'pending', createdAt: '' })).toBe(true);
    expect(canCancel({ id: 'x', userId: 'u', totalCents: 1, status: 'paid', createdAt: '' })).toBe(false);
  });

  it('summarizes a cart', () => {
    expect(
      summarize([
        { productId: 'p1', quantity: 2, unitPriceCents: 100 },
        { productId: 'p2', quantity: 1, unitPriceCents: 100 },
      ]),
    ).toBe('3 items across 2 lines');
  });

  it('summarizes single item correctly', () => {
    expect(
      summarize([
        { productId: 'p1', quantity: 1, unitPriceCents: 100 },
      ]),
    ).toBe('1 item across 1 line');
  });
});

describe('orders · fulfillmentMessage', () => {
  it('returns message for pending order', () => {
    const order = { id: 'ord-1', userId: 'u', totalCents: 1000, status: 'pending' as const, createdAt: '' };
    expect(fulfillmentMessage(order)).toBe('Order ord-1 is awaiting payment.');
  });

  it('returns message for paid order', () => {
    const order = { id: 'ord-1', userId: 'u', totalCents: 1000, status: 'paid' as const, createdAt: '' };
    expect(fulfillmentMessage(order)).toBe('Order ord-1 is being prepared.');
  });

  it('returns message for fulfilled order', () => {
    const order = { id: 'ord-1', userId: 'u', totalCents: 1000, status: 'fulfilled' as const, createdAt: '' };
    expect(fulfillmentMessage(order)).toBe('Order ord-1 has shipped.');
  });

  it('returns message for cancelled order', () => {
    const order = { id: 'ord-1', userId: 'u', totalCents: 1000, status: 'cancelled' as const, createdAt: '' };
    expect(fulfillmentMessage(order)).toBe('Order ord-1 was cancelled.');
  });
});

describe('orders · createOrder', () => {
  let mockDb: Db;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
  });

  it('creates an order with valid input', async () => {
    const input = {
      userId: 'user-123',
      items: [{ productId: 'p1', quantity: 2, unitPriceCents: 1000 }],
      discountCode: null,
      region: 'GB',
    };

    const order = await createOrder(mockDb, input);

    expect(order.userId).toBe('user-123');
    expect(order.status).toBe('pending');
    expect(order.totalCents).toBeGreaterThan(0);
    expect(mockDb.query).toHaveBeenCalledWith(
      'INSERT INTO orders (id, user_id, total_cents, status, created_at) VALUES ($1, $2, $3, $4, $5)',
      expect.any(Array),
    );
  });

  it('throws when order total is 0 or negative', async () => {
    const input = {
      userId: 'user-123',
      items: [{ productId: 'p1', quantity: 0, unitPriceCents: 0 }],
      discountCode: null,
      region: 'GB',
    };

    await expect(createOrder(mockDb, input)).rejects.toThrow('order total must be positive');
  });
});

describe('orders · findOrder', () => {
  let mockDb: Db;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
  });

  it('finds an order by id', async () => {
    const mockOrder = {
      id: 'ord-1',
      userId: 'user-123',
      totalCents: 2400,
      status: 'pending' as const,
      createdAt: '2024-01-01T00:00:00Z',
    };

    (mockDb.query as any).mockResolvedValue({ rows: [mockOrder] });

    const result = await findOrder(mockDb, 'ord-1');

    expect(result).toEqual(mockOrder);
    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT id, user_id AS "userId", total_cents AS "totalCents", status, created_at AS "createdAt" FROM orders WHERE id = $1',
      ['ord-1'],
    );
  });

  it('returns null when order not found', async () => {
    (mockDb.query as any).mockResolvedValue({ rows: [] });

    const result = await findOrder(mockDb, 'non-existent');

    expect(result).toBeNull();
  });
});
