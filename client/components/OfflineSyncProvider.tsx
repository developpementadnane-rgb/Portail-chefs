import { useEffect, useRef } from "react";
import { runReconnectSync, hasAnyOfflineAccess } from "../lib/offline";
import { isChefLoggedIn } from "../lib/authService";

/**
 * Mounted once at the app root (see App.tsx). Renders nothing —
 * its only job is listening for the browser's 'online' event and
 * triggering runReconnectSync(), which flushes the attendance queue
 * and opportunistically refreshes the members/sessions cache.
 *
 * This is the concrete implementation of the strategy doc's
 * "Internet retrouvé → synchronisation automatique avec Supabase":
 * the chef does nothing manually, sync happens the moment the
 * device notices it has a connection again.
 *
 * Fires for EITHER a normally logged-in chef (isChefLoggedIn) OR a
 * device holding valid team-passphrase access (hasAnyOfflineAccess) —
 * the shared passphrase mode is a first-class offline citizen, not an
 * afterthought bolted onto the personal-login path, so a field device
 * that only ever redeemed the team passphrase still gets automatic
 * sync on reconnect exactly like a chef's own device does.
 *
 * A ref-based in-flight guard prevents overlapping syncs if the
 * browser fires multiple 'online' events in quick succession (which
 * happens on some mobile networks flapping between towers).
 */
export default function OfflineSyncProvider() {
  const syncInFlight = useRef(false);

  useEffect(() => {
    async function handleOnline() {
      if (syncInFlight.current) return;

      const eligible = isChefLoggedIn() || (await hasAnyOfflineAccess());
      if (!eligible) return;

      syncInFlight.current = true;
      try {
        const result = await runReconnectSync();
        if (result.flush.accepted > 0 || result.flush.superseded > 0) {
          console.info(
            `[offline] Sync complete: ${result.flush.accepted} accepted, ${result.flush.superseded} superseded, ${result.flush.errors} pending retry`,
          );
        }
      } catch (error) {
        console.warn("[offline] Reconnect sync failed:", error);
      } finally {
        syncInFlight.current = false;
      }
    }

    window.addEventListener("online", handleOnline);

    // Also attempt once on mount: covers the case where the app was
    // launched (e.g. from a home-screen PWA icon) already online with
    // a queue left over from a previous offline session, without
    // waiting for an actual 'online' transition event that won't fire
    // if the device was never marked offline in the first place.
    if (typeof navigator === "undefined" || navigator.onLine) {
      handleOnline();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
