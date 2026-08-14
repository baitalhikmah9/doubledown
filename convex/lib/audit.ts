import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

/**
 * Append an immutable audit entry for an admin mutation.
 * The admin_audit_log table is append-only; no update/delete mutations exist.
 */
export async function writeAudit(
  ctx: MutationCtx,
  args: {
    actorUserId: Id<'users'>;
    actorEmail?: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> {
  await ctx.db.insert('admin_audit_log', {
    actorUserId: args.actorUserId,
    actorEmail: args.actorEmail,
    timestamp: Date.now(),
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    reason: args.reason,
    before: args.before,
    after: args.after,
  });
}
