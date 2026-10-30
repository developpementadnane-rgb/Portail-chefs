/**
 * Reads the member badge QR format defined by the members portal (see
 * that project's client/lib/badgeQr.ts, which shares the exact same
 * crypto module as our client/lib/badgeCrypto.ts -- both copies must
 * stay identical). The chef app only ever PARSES/DECRYPTS these --
 * it never generates one.
 *
 * Format recap: the QR encodes `data:text/html;base64,<...>` -- a
 * tiny self-contained styled HTML page (so scanning it with any
 * phone's stock camera app shows a generic card, fully offline, with
 * no personal data readable in the clear) with an AES-256-GCM
 * encrypted payload embedded as JSON in a
 * `<script type="application/json" id="d">` tag. See badgeCrypto.ts
 * for the full cryptographic design.
 */

import { decryptBadgePayload, type BadgeMemberPayload } from "./badgeCrypto";

export interface ParsedMemberBadge {
  valid: boolean;
  generatedId?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianPhone?: string | null;
  guardianPhone2?: string | null;
  medicalInfo?: string | null;
}

function toParsedBadge(payload: BadgeMemberPayload): ParsedMemberBadge {
  return {
    valid: true,
    generatedId: payload.i,
    firstName: payload.f,
    lastName: payload.l,
    birthDate: payload.b,
    guardianFirstName: payload.gf,
    guardianLastName: payload.gl,
    guardianPhone: payload.gp,
    guardianPhone2: payload.gp2,
    medicalInfo: payload.m,
  };
}

/**
 * Decrypts and parses a scanned badge. Async now (Web Crypto is
 * async) -- callers that used to treat parseMemberBadge as
 * synchronous need `await`, see AttendanceScan.tsx.
 */
export async function parseMemberBadge(raw: string): Promise<ParsedMemberBadge> {
  const decoded = await decryptBadgePayload(raw);
  if (!decoded.valid || !decoded.payload) return { valid: false };
  return toParsedBadge(decoded.payload);
}
