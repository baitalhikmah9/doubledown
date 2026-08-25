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

type JsonObject = { [key: string]: JsonBody };
type JsonBody = string | number | boolean | null | JsonBody[] | JsonObject;

function isJsonObject(body: JsonBody): body is JsonObject {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

function mockResponse(body: JsonBody, status = 200): Response {
  const ok = status >= 200 && status < 300;
  const textBody = isJsonObject(body) || Array.isArray(body) ? JSON.stringify(body) : String(body);
  // SAFETY: Partial Response stub is sufficient for the RevenueCat client under test.
  return {
    ok,
    status,
    json: async () => (isJsonObject(body) || Array.isArray(body) ? body : { raw: String(body) }),
    text: async () => textBody,
  // SAFETY: Controlled test boundary cast under fixture invariants.
  } as Response;
}

function asFetch(impl: (...args: never[]) => Promise<Response>): typeof fetch {
  // SAFETY: Test doubles only need the subset of fetch used by the V2 client.
  return impl as typeof fetch;
}

type FetchCall = [input: RequestInfo | URL, init?: RequestInit];
function lastFetchCall(mock: { mock: { calls: unknown[] } }): FetchCall {
  const call = mock.mock.calls.at(-1);
  if (!call || !Array.isArray(call)) {
    throw new Error('expected fetch mock call');
  }
  return call as FetchCall;
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
        fetchImpl: asFetch(fetchMock),
      });
      expect(result).toEqual({ id: 'dis_123', identifier: 'promo_mikhail10' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/projects/proj_test_123/discounts');
      expect(init?.method).toBe('POST');
      const bodyText = init?.body != null && String(init.body) === init.body ? init.body : '';
      // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
      const body = JSON.parse(bodyText) as {
        type: string;
        percentage: number;
        duration_mode: string;
        product_identifiers: string[];
      };
      expect(body.type).toBe('percentage');
      expect(body.percentage).toBe(10);
      expect(body.duration_mode).toBe('one_time');
      expect(body.product_identifiers).toEqual(['com.backfire.tokens50']);
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer sk_v2_test_secret',
      });
    });

    it('throws RevenueCatV2Error on non-2xx response', async () => {
      const fetchMock = jest.fn(async () => mockResponse({ error: 'bad request' }, 400));
      await expect(
        createPercentageDiscount({
          identifier: 'promo_test',
          customerFacingName: 'Test',
          percentage: 10,
          productIdentifier: 'com.test.product',
          fetchImpl: asFetch(fetchMock),
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
          fetchImpl: asFetch(fetchMock),
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
        fetchImpl: asFetch(fetchMock),
      });
      expect(result).toEqual({ code: 'MIKHAIL10' });
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/discounts/dis_123/discount_codes');
      const bodyText = init?.body != null && String(init.body) === init.body ? init.body : '';
      // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
      const body = JSON.parse(bodyText) as { codes: string[] };
      expect(body.codes).toEqual(['MIKHAIL10']);
    });
  });

  describe('disableDiscount', () => {
    it('posts to the disable action endpoint', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await disableDiscount({
        discountId: 'dis_123',
        fetchImpl: asFetch(fetchMock),
      });
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/discounts/dis_123/actions/disable');
      expect(init?.method).toBe('POST');
    });

    // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
    it('treats 404 as success (idempotent)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        disableDiscount({
          discountId: 'dis_gone',
          fetchImpl: asFetch(fetchMock),
        })
      ).resolves.toBeUndefined();
    });

    it('throws on other errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        disableDiscount({
          discountId: 'dis_123',
          fetchImpl: asFetch(fetchMock),
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
        fetchImpl: asFetch(fetchMock),
      });
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/discounts/dis_123/discount_codes/MIKHAIL10');
      expect(init?.method).toBe('DELETE');
    });

    // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
    it('treats 404 as success (idempotent)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        deleteDiscountCode({
          discountId: 'dis_123',
          code: 'GONE',
          fetchImpl: asFetch(fetchMock),
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
        fetchImpl: asFetch(fetchMock),
      });
      expect(codes).toEqual(['MIKHAIL10', 'OTHER20']);
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/discounts/dis_123/discount_codes');
      expect(init?.method).toBe('GET');
    });

    it('returns empty array when data is missing', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}));
      const codes = await listDiscountCodes({
        discountId: 'dis_123',
        fetchImpl: asFetch(fetchMock),
      });
      expect(codes).toEqual([]);
    });

    it('throws on non-200', async () => {
      const fetchMock = jest.fn(async () => mockResponse('error', 500));
      await expect(
        listDiscountCodes({
          discountId: 'dis_123',
          fetchImpl: asFetch(fetchMock),
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
        fetchImpl: asFetch(fetchMock),
      });
      expect(result).toEqual({ attached: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
    it('treats 409 as success when the code exists on the discount', async () => {
      const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return mockResponse('conflict', 409);
        }
        return mockResponse({ data: [{ code: 'MIKHAIL10' }] });
      });
      const result = await ensureDiscountCode({
        discountId: 'dis_123',
        code: 'MIKHAIL10',
        fetchImpl: asFetch(fetchMock),
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
          fetchImpl: asFetch(fetchMock),
        })
      ).rejects.toThrow('revenuecat_v2_code_conflict_on_different_discount');
    });

    it('throws on non-409 errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        ensureDiscountCode({
          discountId: 'dis_123',
          code: 'MIKHAIL10',
          fetchImpl: asFetch(fetchMock),
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });

  describe('enableDiscount', () => {
    it('posts to the enable action endpoint', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await enableDiscount({
        discountId: 'dis_123',
        fetchImpl: asFetch(fetchMock),
      });
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/discounts/dis_123/actions/enable');
      expect(init?.method).toBe('POST');
    });

    it('throws on 404 so the caller can recover (stale persisted id)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        enableDiscount({
          discountId: 'dis_gone',
          fetchImpl: asFetch(fetchMock),
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });

    it('isDiscountNotFoundError identifies the 404 enable error', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      let caught: Error | null = null;
      try {
        await enableDiscount({
          discountId: 'dis_gone',
          fetchImpl: asFetch(fetchMock),
        });
      } catch (e) {
        caught = e instanceof Error ? e : new Error(String(e));
      }
      expect(isDiscountNotFoundError(caught)).toBe(true);
    });

    it('isDiscountNotFoundError returns false for non-404 errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      let caught: Error | null = null;
      try {
        await enableDiscount({
          discountId: 'dis_123',
          fetchImpl: asFetch(fetchMock),
        });
      } catch (e) {
        caught = e instanceof Error ? e : new Error(String(e));
      }
      expect(isDiscountNotFoundError(caught)).toBe(false);
    });

    it('throws on other errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        enableDiscount({
          discountId: 'dis_123',
          fetchImpl: asFetch(fetchMock),
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });

  describe('deleteDiscount', () => {
    it('DELETEs the discount by id', async () => {
      const fetchMock = jest.fn(async () => mockResponse({}, 200));
      await deleteDiscount({
        discountId: 'dis_123',
        fetchImpl: asFetch(fetchMock),
      });
      const [url, init] = lastFetchCall(fetchMock);
      expect(String(url)).toContain('/discounts/dis_123');
      expect(String(url)).not.toContain('/actions/');
      expect(String(url)).not.toContain('/discount_codes/');
      expect(init?.method).toBe('DELETE');
    });

    // SAFETY: Test fixture / double boundary cast justified by controlled test setup.
    it('treats 404 as success (idempotent)', async () => {
      const fetchMock = jest.fn(async () => mockResponse('not found', 404));
      await expect(
        deleteDiscount({
          discountId: 'dis_gone',
          fetchImpl: asFetch(fetchMock),
        })
      ).resolves.toBeUndefined();
    });

    it('throws on other errors', async () => {
      const fetchMock = jest.fn(async () => mockResponse('server error', 500));
      await expect(
        deleteDiscount({
          discountId: 'dis_123',
          fetchImpl: asFetch(fetchMock),
        })
      ).rejects.toThrow(RevenueCatV2Error);
    });
  });
});
