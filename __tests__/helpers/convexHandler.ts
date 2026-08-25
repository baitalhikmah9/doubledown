/**
 * Extract a Convex registered function's internal `_handler` for unit tests.
 *
 * Convex wraps handlers; unit tests invoke `_handler(ctx, args)` directly.
 */

// Ctx/Args/Result are test-side stand-ins for Convex's registered function generics.
 
export type ConvexHandler<Ctx = any, Args = any, Result = any> = (
  ctx: Ctx,
  args: Args
) => Promise<Result>;

export function getConvexHandler<Ctx, Args, Result>(fn: unknown): ConvexHandler<Ctx, Args, Result> {
  // Registered Convex functions expose `_handler` at runtime for unit tests.
  const registered = fn as { _handler?: ConvexHandler<Ctx, Args, Result> };
  if (typeof registered._handler !== 'function') {
    throw new Error('Convex function is missing _handler');
  }
  return registered._handler;
}
