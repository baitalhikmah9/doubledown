import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import {
  RevenueCatV2Error,
  createPercentageDiscount,
  createDiscountCode,
  ensureDiscountCode,
  listDiscountCodes,
  disableDiscount,
  enableDiscount,
  isDiscountNotFoundError,
  deleteDiscount,
  deleteDiscountCode,
  isValidRevenueCatDiscountCode,
  buildRevenueCatDiscountIdentifier,
} from '../../convex/lib/revenueCatApiV2';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body as Record<string, unknown>,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

describe('revenueCatApiV2', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.REVENUECAT_V2_SECRET_API_KEY = 'sk_v2_test_secret';
    process.env.REVENUECAT_PROJECT_ID = 'proj_test_123';
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe('isValidRevenueCatDiscountCode', () => {
    it('accepts alphanumeric and underscore codes', () => {
      expect(isValidRevenueCatDiscountCode('MIKHAIL10')).toBe(true);
      expect(isValidRevenueCatDiscountCode('promo_50_off')).toBe(true);
      expect(isValidRevenueCatDiscountCode('ABC123')).toBe(true);
    });

    it('rejects codes with spaces, hyphens, or special characters', () => {
      expect(isValidRevenueCatDiscountCode('MIKHAIL 10')).toBe(false);
      expect(isValidRevenueCatDiscountCode('50-OFF')).toBe(false);
      expect(isValidRevenueCatDiscountCode('50%OFF')).toBe(false);
      expect(isValidRevenueCatDiscountCode('')).toBe(false);
      expect(isValidRevenueCatDiscountCode('   ')).toBe(false);
    });
  });

  describe('buildRevenueCatDiscountIdentifier', () => {
    it('builds a stable identifier from the local code', () => {
      expect(buildRevenueCatDiscountIdentifier('mikhail10')).toBe('promo_mikhail10');
    });

    it('replaces non-alphanumeric characters with underscores', () => {
      expect(buildRevenueCatDiscountIdentifier('50-off')).toBe('promo_50_off');
    });

    it('truncates to 100 characters', () => {
      const longCode = 'a'.repeat(200);
      const identifier = buildRevenueCatDiscountIdentifier(longCode);
      expect(identifier.length).toBe(100);
      expect(identifier.startsWith('promo_')).toBe(true);
    });
  });

  describe('createPercentageDiscount', () => {
    it('sends the correct payload and returns the discount id', async () => {
      const fetchMock = jest.fn(async () =>
        mockResponse({ id: 'dis_123', identifier: 'promo_mikhail10' })
      );
      const result = await createPercentageDiscount({
        identifier: 'promo_mikhail10',
        customerFacingName: 'Promo mikhail10',
        percentage: 10,
        productIdentifier: 'com.backfire.tokens50',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result).toEqual({ id: 'dis_123', identifier: 'promo_mikhail10' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/projects/proj_test_123/discounts');
      expect(init?.method).toBe('POST');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.type).toBe('percentage');
      expect(body.percentage).toBe(10);
      expect(body.duration_mode).toBe('one_time');
      expect(body.product_identifiers).toEqual(['com.backfire.tokens50']);
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer sk_v2_test_secret',
      });
    });

    it('throws RevenueCatV2Error on non-2xx response', async () => {
      const fetchMock = jest.fn(async () =>
        mockResponse({ error: 'bad request' }, 400)
      );
      await expect(
        createPercentageDiscount({
          identifier: 'promo_test',
          customerFacingName: 'Test',
          percentage: 10,
          productIdentifier: 'com.test.product',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });

    it('throws when env config is missing', async () => {
      delete process.env.REVENUECAT_V2_SECRET_API_KEY;
      await expect(
        createPercentageDiscount({
          identifier: 'promo_test',
          customerFacingName: 'Test',
          percentage: 10,
          productIdentifier: 'com.test.product',
        })
      ).rejects.toThrow('revenuecat_v2_not_configured');
    });

    it('throws when the response is missing the id field', async () => {
      const fetchMock = jest.fn(async () => mockResponse({ identifier: 'x' }));
      await expect(
        createPercentageDiscount({
          identifier: 'promo_test',
          customerFacingName: 'Test',
          percentage: 10,
          productIdentifier: 'com.test.product',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow('revenuecat_v2_create_discount_malformed');
    });
  });

  describe('createDiscountCode', () => {
    it('sends the code in the codes array', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}));
      const result = await createDiscountCode({
        discountId: 'dis_123',
        code: 'MIKHAIL10',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result).toEqual({ code: 'MIKHAIL10' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/discounts/dis_123/discount_codes');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.codes).toEqual(['MIKHAIL10']);
    });
  });

  describe('disableDiscount', () => {
    it('posts to the disable action endpoint', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await disableDiscount({
        discountId: 'dis_123',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/discounts/dis_123/actions/disable');
      expect(init?.method).toBe('POST');
    });

    it('treats 404 as success (idempotent)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        disableDiscount({
          discountId: 'dis_gone',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).resolves.toBeUndefined();
    });

    it('throws on other errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        disableDiscount({
          discountId: 'dis_123',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });

  describe('deleteDiscountCode', () => {
    it('deletes the code by id', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await deleteDiscountCode({
        discountId: 'dis_123',
        code: 'MIKHAIL10',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/discounts/dis_123/discount_codes/MIKHAIL10');
      expect(init?.method).toBe('DELETE');
    });

    it('treats 404 as success (idempotent)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        deleteDiscountCode({
          discountId: 'dis_123',
          code: 'GONE',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('listDiscountCodes', () => {
    it('GETs the discount codes list and returns code strings', async () => {
      const fetchMock = jest.fn(async () =>
        mockResponse({ data: [{ code: 'MIKHAIL10' }, { code: 'OTHER20' }] })
      );
      const codes = await listDiscountCodes({
        discountId: 'dis_123',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(codes).toEqual(['MIKHAIL10', 'OTHER20']);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/discounts/dis_123/discount_codes');
      expect(init?.method).toBe('GET');
    });

    it('returns empty array when data is missing', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}));
      const codes = await listDiscountCodes({
        discountId: 'dis_123',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(codes).toEqual([]);
    });

    it('throws on non-200', async () => {
      const fetchMock = jest.fn(async () => mockResponse('error', 500));
      await expect(
        listDiscountCodes({
          discountId: 'dis_123',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });

  describe('ensureDiscountCode', () => {
    it('creates the code on 200 and returns attached', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}));
      const result = await ensureDiscountCode({
        discountId: 'dis_123',
        code: 'MIKHAIL10',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result).toEqual({ attached: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('treats 409 as success when the code exists on the discount', async () => {
      const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return mockResponse('conflict', 409);
        }
        // GET list returns the code
        return mockResponse({ data: [{ code: 'MIKHAIL10' }] });
      });
      const result = await ensureDiscountCode({
        discountId: 'dis_123',
        code: 'MIKHAIL10',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(result).toEqual({ attached: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws on 409 when the code is NOT on the discount', async () => {
      const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return mockResponse('conflict', 409);
        }
        return mockResponse({ data: [{ code: 'OTHER20' }] });
      });
      await expect(
        ensureDiscountCode({
          discountId: 'dis_123',
          code: 'MIKHAIL10',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow('revenuecat_v2_code_conflict_on_different_discount');
    });

    it('throws on non-409 errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        ensureDiscountCode({
          discountId: 'dis_123',
          code: 'MIKHAIL10',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });

  describe('enableDiscount', () => {
    it('posts to the enable action endpoint', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await enableDiscount({
        discountId: 'dis_123',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/discounts/dis_123/actions/enable');
      expect(init?.method).toBe('POST');
    });

    it('throws on 404 so the caller can recover (stale persisted id)', async () => {
      // A 404 means the persisted provider discount id is stale (the discount
      // was deleted at the provider). Throwing lets the caller branch into
      // automatic recovery instead of silently retrying against a nonexistent
      // discount forever.
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        enableDiscount({
          discountId: 'dis_gone',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });

    it('isDiscountNotFoundError identifies the 404 enable error', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      let caught: unknown;
      try {
        await enableDiscount({
          discountId: 'dis_gone',
          fetchImpl: fetchMock as unknown as typeof fetch,
        });
      } catch (e) {
        caught = e;
      }
      expect(isDiscountNotFoundError(caught)).toBe(true);
    });

    it('isDiscountNotFoundError returns false for non-404 errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      let caught: unknown;
      try {
        await enableDiscount({
          discountId: 'dis_123',
          fetchImpl: fetchMock as unknown as typeof fetch,
        });
      } catch (e) {
        caught = e;
      }
      expect(isDiscountNotFoundError(caught)).toBe(false);
    });

    it('throws on other errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        enableDiscount({
          discountId: 'dis_123',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });

  describe('deleteDiscount', () => {
    it('DELETEs the discount by id', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await deleteDiscount({
        discountId: 'dis_123',
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/discounts/dis_123');
      expect(url).not.toContain('/actions/');
      expect(url).not.toContain('/discount_codes/');
      expect(init?.method).toBe('DELETE');
    });

    it('treats 404 as success (idempotent)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        deleteDiscount({
          discountId: 'dis_gone',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).resolves.toBeUndefined();
    });

    it('throws on other errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        deleteDiscount({
          discountId: 'dis_123',
          fetchImpl: fetchMock as unknown as typeof fetch,
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });
});
