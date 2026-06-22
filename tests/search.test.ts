import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rankByRelevance, searchProducts } from '../lib/search';
import type { Db } from '../lib/db';

describe('search · ranking', () => {
  it('places exact matches first', () => {
    const ranked = rankByRelevance(
      [
        { id: 'a', name: 'hammer drill', priceCents: 0, inStock: true },
        { id: 'b', name: 'drill', priceCents: 0, inStock: true },
      ],
      'drill',
    );
    expect(ranked[0].id).toBe('b');
  });

  it('sorts by exact match priority', () => {
    const products = [
      { id: '1', name: 'Apple', priceCents: 100, inStock: true },
      { id: '2', name: 'apples', priceCents: 200, inStock: true },
      { id: '3', name: 'Pineapple', priceCents: 300, inStock: true },
    ];

    const ranked = rankByRelevance(products, 'apple');

    expect(ranked[0].name.toLowerCase()).toBe('apple');
  });

  it('sorts alphabetically within same priority', () => {
    const products = [
      { id: '1', name: 'Zebra', priceCents: 100, inStock: true },
      { id: '2', name: 'Apple', priceCents: 200, inStock: true },
    ];

    const ranked = rankByRelevance(products, 'nonexistent');

    expect(ranked[0].id).toBe('2');
  });

  it('does not mutate the input array', () => {
    const products = [
      { id: 'a', name: 'hammer drill', priceCents: 0, inStock: true },
      { id: 'b', name: 'drill', priceCents: 0, inStock: true },
    ];
    const originalOrder = products.map((p) => p.id);

    rankByRelevance(products, 'drill');

    expect(products.map((p) => p.id)).toEqual(originalOrder);
  });
});

describe('search · searchProducts', () => {
  let mockDb: Db;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
  });

  it('returns empty array for empty query', async () => {
    const result = await searchProducts(mockDb, '');
    expect(result).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', async () => {
    const result = await searchProducts(mockDb, '   ');
    expect(result).toEqual([]);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('throws for query longer than 200 chars', async () => {
    const longQuery = 'a'.repeat(201);
    await expect(searchProducts(mockDb, longQuery)).rejects.toThrow('query too long');
  });

  it('searches for products with trimmed query', async () => {
    const mockProducts = [
      { id: '1', name: 'hammer', priceCents: 1000, inStock: true },
    ];

    (mockDb.query as any).mockResolvedValue({ rows: mockProducts });

    const result = await searchProducts(mockDb, '  hammer  ');

    expect(result).toEqual(mockProducts);
    expect(mockDb.query).toHaveBeenCalledWith(
      'SELECT id, name, price_cents AS "priceCents", in_stock AS "inStock" FROM products WHERE name ILIKE $1 LIMIT $2',
      ['%hammer%', 20],
    );
  });

  it('respects custom limit', async () => {
    const mockProducts = [];

    (mockDb.query as any).mockResolvedValue({ rows: mockProducts });

    await searchProducts(mockDb, 'test', 50);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.any(String),
      ['%test%', 50],
    );
  });

  it('handles case-insensitive search', async () => {
    const mockProducts = [
      { id: '1', name: 'Hammer Drill', priceCents: 1000, inStock: true },
    ];

    (mockDb.query as any).mockResolvedValue({ rows: mockProducts });

    const result = await searchProducts(mockDb, 'HAMMER');

    expect(result).toEqual(mockProducts);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      ['%HAMMER%', 20],
    );
  });
});
