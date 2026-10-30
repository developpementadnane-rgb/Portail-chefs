/**
 * Membership sync queue — same offline-first pattern as
 * attendanceQueue (see syncQueue.ts), applied to the "gestion
 * adhésion" toggles (payment_completed / documents_completed).
 *
 * Simpler than attendance sync: there's no session concept and the
 * server route is a plain `update` (see server/routes/membership.ts),
 * so a queued op is just "last write wins" once it reaches the
 * server — no accepted/duplicate/superseded outcomes to reconcile.
 */

import { idbGetAll, idbPut, idbDelete, STORES } from "./db";
import { getOfflineAuthHeaders } from "./accessMode";
import { getAuthHeaders } from "../api";
import { API_BASE_URL } from "../apiConfig";
import { patchCachedMemberMembership } from "./membersCache";

export interface QueuedMembershipOp {
  client_op_id: string;
  member_id: string;
  payment_completed?: boolean;
  documents_completed?: boolean;
  queued_at: string;
  attempt_count: number;
}

/**
 * Queue a membership update. Safe offline or online — writes to the
 * local cache immediately (optimistic UI) and queues for sync.
 */
export async function queueMembershipUpdate(input: {
  memberId: string;
  paymentCompleted?: boolean;
  documentsCompleted?: boolean;
}): Promise<string> {
  const clientOpId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const op: QueuedMembershipOp = {
    client_op_id: clientOpId,
    member_id: input.memberId,
    payment_completed: input.paymentCompleted,
    documents_completed: input.documentsCompleted,
    queued_at: new Date().toISOString(),
    attempt_count: 0,
  };

  await idbPut(STORES.membershipQueue, op);

  await patchCachedMemberMembership(input.memberId, {
    ...(input.paymentCompleted !== undefined && { payment_completed: input.paymentCompleted }),
    ...(input.documentsCompleted !== undefined && { documents_completed: input.documentsCompleted }),
  });

  return clientOpId;
}

export async function getMembershipQueueLength(): Promise<number> {
  const all = await idbGetAll<QueuedMembershipOp>(STORES.membershipQueue);
  return all.length;
}

export interface MembershipFlushSummary {
  attempted: number;
  succeeded: number;
  errors: number;
  networkFailure: boolean;
}

/** Sends the queued membership updates to the server one by one. */
export async function flushMembershipQueue(): Promise<MembershipFlushSummary> {
  const queued = await idbGetAll<QueuedMembershipOp>(STORES.membershipQueue);

  if (queued.length === 0) {
    return { attempted: 0, succeeded: 0, errors: 0, networkFailure: false };
  }

  let succeeded = 0;
  let errors = 0;
  let networkFailure = false;

  for (const op of queued) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/membership/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
          ...(await getOfflineAuthHeaders()),
        },
        body: JSON.stringify({
          member_id: op.member_id,
          ...(op.payment_completed !== undefined && { payment_completed: op.payment_completed }),
          ...(op.documents_completed !== undefined && { documents_completed: op.documents_completed }),
        }),
      });

      if (!response.ok) {
        errors += 1;
        await idbPut(STORES.membershipQueue, { ...op, attempt_count: op.attempt_count + 1 });
        continue;
      }

      succeeded += 1;
      await idbDelete(STORES.membershipQueue, op.client_op_id);
    } catch {
      networkFailure = true;
      await idbPut(STORES.membershipQueue, { ...op, attempt_count: op.attempt_count + 1 });
    }
  }

  return { attempted: queued.length, succeeded, errors, networkFailure };
}
