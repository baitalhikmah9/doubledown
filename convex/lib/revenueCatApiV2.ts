/**
 * Server-only RevenueCat API v2 client.
 *
 * Uses fetch (available in Convex actions). Never exposes the secret key to
 * the client: this module is only imported from Convex actions, which run on
 * the server and read `REVENUECAT_V2_SECRET_API_KEY` from process.env.
 *
 * Required Convex environment variables:
 * - `REVENUECAT_V2_SECRET_API_KEY`: a RevenueCat v2 secret API key with the
 *   `project_configuration:discounts:read_write` permission.
 * - `REVENUECAT_PROJECT_ID`: the RevenueCat project id.
 *
 * Both must be set in the Convex dashboard environment variables. If either is
 * missing, every call throws `revenuecat_v2_not_configured` so admin UI can
 * surface a clear message instead of silently failing.
 */

const API_BASE = 'https://api.revenuecat.com/v2';

export interface RevenueCatDiscount {
  id: string;
  identifier: string;
}

export interface RevenueCatDiscountCode {
  code: string;
}

export class RevenueCatV2Error extends Error {
  readonly status: number;
  readonly body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'RevenueCatV2Error';
    this.status = status;
    this.body = body;
  }
}

function getConfig() {
  const secret = process.env.REVENUECAT_V2_SECRET_API_KEY;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!secret?.trim() || !projectId?.trim()) {
    throw new RevenueCatV2Error(
      'revenuecat_v2_not_configured',
      0,
      'REVENUECAT_V2_SECRET_API_KEY or REVENUECAT_PROJECT_ID is not set in Convex environment variables.'
    );
  }
  return { secret: secret.trim(), projectId: projectId.trim() };
}

async function parseError(response: Response, action: string): Promise<RevenueCatV2Error> {
  const body = await response.text().catch(() => '');
  return new RevenueCatV2Error(
    `revenuecat_v2_${action}_failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`,
    response.status,
    body
  );
}

/**
 * Create a percentage, one-time discount scoped to a single product identifier.
 * Returns the provider discount id and identifier.
 */
export async function createPercentageDiscount(args: {
  identifier: string;
  customerFacingName: string;
  percentage: number;
  productIdentifier: string;
  fetchImpl?: typeof fetch;
}): Promise<RevenueCatDiscount> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'X-Platform': 'backend',
      },
      body: JSON.stringify({
        identifier: args.identifier,
        customer_facing_name: args.customerFacingName,
        type: 'percentage',
        percentage: args.percentage,
        duration_mode: 'one_time',
        eligibility: 'everyone',
        product_identifiers: [args.productIdentifier],
      }),
    }
  );
  if (!response.ok) {
    throw await parseError(response, 'create_discount');
  }
  const data = (await response.json()) as { id?: string; identifier?: string };
  if (!data.id || !data.identifier) {
    throw new RevenueCatV2Error(
      'revenuecat_v2_create_discount_malformed',
      response.status,
      JSON.stringify(data)
    );
  }
  return { id: data.id, identifier: data.identifier };
}

/**
 * Attach a single discount code to an existing discount. The code must match
 * ^[A-Za-z0-9_]+$. We send the canonical uppercase form.
 *
 * On 409 (code already exists for this discount), the caller is expected to
 * verify the existing code via `listDiscountCodes` before treating it as
 * success. This function throws on 409 so the caller can branch.
 */
export async function createDiscountCode(args: {
  discountId: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<RevenueCatDiscountCode> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts/${encodeURIComponent(args.discountId)}/discount_codes`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'X-Platform': 'backend',
      },
      body: JSON.stringify({ codes: [args.code] }),
    }
  );
  if (!response.ok) {
    throw await parseError(response, 'create_code');
  }
  return { code: args.code };
}

/**
 * List discount codes attached to a discount. Used to verify a code already
 * exists on a discount when `createDiscountCode` returns 409, so retry is
 * idempotent. Returns the set of codes (uppercase as stored by RevenueCat).
 */
export async function listDiscountCodes(args: {
  discountId: string;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts/${encodeURIComponent(args.discountId)}/discount_codes`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-Platform': 'backend',
      },
    }
  );
  if (!response.ok) {
    throw await parseError(response, 'list_codes');
  }
  const data = (await response.json()) as { data?: { code?: string }[] };
  return (data.data ?? [])
    .map((item) => (typeof item.code === 'string' ? item.code : null))
    .filter((c): c is string => c !== null);
}

/**
 * Idempotently attach a discount code. On 409 (code already exists), verify
 * the code exists on this exact discount via `listDiscountCodes`; if it does,
 * treat as success. If the 409 was for a different code or discount, fail.
 * Returns true if the code is attached (newly or already), false on
 * unrecoverable conflict.
 */
export async function ensureDiscountCode(args: {
  discountId: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<{ attached: true }> {
  try {
    await createDiscountCode(args);
    return { attached: true };
  } catch (error) {
    if (error instanceof RevenueCatV2Error && error.status === 409) {
      // Verify the code exists on this discount before treating 409 as success.
      const codes = await listDiscountCodes({
        discountId: args.discountId,
        fetchImpl: args.fetchImpl,
      });
      if (codes.includes(args.code)) {
        return { attached: true };
      }
      // 409 but the code is not on this discount: real conflict.
      throw new RevenueCatV2Error(
        'revenuecat_v2_code_conflict_on_different_discount',
        409,
        error.body
      );
    }
    throw error;
  }
}

/**
 * Disable a discount so its codes can no longer be applied at checkout. Used
 * for deactivation and expiry lifecycle. Idempotent: a 404 (discount already
 * gone) is treated as success.
 */
export async function disableDiscount(args: {
  discountId: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts/${encodeURIComponent(args.discountId)}/actions/disable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'X-Platform': 'backend',
      },
    }
  );
  if (response.ok || response.status === 404) {
    return;
  }
  throw await parseError(response, 'disable_discount');
}

/**
 * Enable a previously disabled discount so its codes can be applied again.
 * Used during provisioning retry when a promo has a persisted discount id but
 * the local status is failed/pending (the discount may have been disabled by
 * a prior compensating cleanup).
 *
 * A 404 is NOT treated as success: the persisted provider discount id is stale
 * (the discount was deleted at the provider). The caller must recover by
 * clearing the stale id and creating a fresh discount. Throwing on 404 lets
 * the caller branch into automatic recovery instead of silently retrying
 * against a nonexistent discount forever.
 */
export async function enableDiscount(args: {
  discountId: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts/${encodeURIComponent(args.discountId)}/actions/enable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'X-Platform': 'backend',
      },
    }
  );
  if (response.ok) {
    return;
  }
  throw await parseError(response, 'enable_discount');
}

/**
 * Type guard for the 404 "discount gone" error thrown by enableDiscount. The
 * caller uses this to branch into automatic recovery (clear stale id, create a
 * fresh discount).
 */
export function isDiscountNotFoundError(error: unknown): boolean {
  return (
    error instanceof RevenueCatV2Error && error.status === 404
  );
}

/**
 * Delete a discount entirely. Used for orphan cleanup when a provider discount
 * was created but could not be persisted locally, so a retry would collide on
 * the deterministic identifier. Idempotent against 404.
 */
export async function deleteDiscount(args: {
  discountId: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts/${encodeURIComponent(args.discountId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-Platform': 'backend',
      },
    }
  );
  if (response.ok || response.status === 404) {
    return;
  }
  throw await parseError(response, 'delete_discount');
}

/**
 * Delete a single discount code. Used for compensating cleanup when a local
 * promo creation fails after the provider code was already created. Idempotent
 * against 404.
 */
export async function deleteDiscountCode(args: {
  discountId: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const { secret, projectId } = getConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/discounts/${encodeURIComponent(args.discountId)}/discount_codes/${encodeURIComponent(args.code)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-Platform': 'backend',
      },
    }
  );
  if (response.ok || response.status === 404) {
    return;
  }
  throw await parseError(response, 'delete_code');
}

/**
 * Validate that a code matches the RevenueCat discount code pattern
 * ^[A-Za-z0-9_]+$. Does not transform case; callers send the canonical
 * uppercase form to the provider while keeping local storage lowercase.
 */
export function isValidRevenueCatDiscountCode(code: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(code);
}

/**
 * Build a stable RevenueCat discount identifier from the local promo code.
 * Identifiers must be 1-100 chars and unique within the project. We prefix
 * with `promo_` and use the lowercase code so the identifier is deterministic
 * and traceable to the local promo.
 */
export function buildRevenueCatDiscountIdentifier(localCode: string): string {
  const base = `promo_${localCode}`.replace(/[^A-Za-z0-9_]/g, '_');
  return base.slice(0, 100);
}
