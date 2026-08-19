import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

/**
 * Scheduled jobs.
 *
 * Hourly reconciliation: disables RevenueCat discounts for promos whose
 * `activeTo` has passed (expired) and retries provider disable for promos in
 * `disable_pending` state (deactivation that could not reach the provider).
 * This is the Convex-native fallback for expiry; per-promo exact-time expiry
 * is also scheduled via ctx.scheduler.runAt at provisioning time when an
 * activeTo is known.
 */
const crons = cronJobs();

crons.interval(
  'reconcile-discount-lifecycle',
  { hours: 1 },
  internal.admin.reconcileDiscountLifecycle,
  {}
);

export default crons;
